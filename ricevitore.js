/*
 * Tomo — ricevitore dei QR animati (la parte "pura": niente pagina, niente fotocamera).
 * Ogni QR: "TOMO1|id|i|n|crc|nome-base64|dati-base64". Si rimettono insieme in qualsiasi ordine,
 * anche ripetuti, e alla fine il CRC32 deve tornare con quello mandato da Tomo.
 * Scritto in JavaScript "vecchio stile" (ES5) così gira su ogni telefono e si prova sul PC.
 */
var TomoQr = (function () {
    var ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var VALORI = {};
    for (var a = 0; a < ALFABETO.length; a++) VALORI[ALFABETO.charAt(a)] = a;

    function base64(s) {
        s = s.replace(/=+$/, "");
        var n = Math.floor(s.length * 3 / 4);
        var out = new Uint8Array(n);
        var j = 0, buf = 0, bit = 0;
        for (var i = 0; i < s.length; i++) {
            var v = VALORI[s.charAt(i)];
            if (v === undefined) return null;
            buf = (buf << 6) | v;
            bit += 6;
            if (bit >= 8) {
                bit -= 8;
                out[j++] = (buf >> bit) & 0xff;
            }
        }
        return j === n ? out : out.subarray(0, j);
    }

    function testoUtf8(b) {
        var s = "";
        for (var i = 0; i < b.length; i++) s += "%" + ("0" + b[i].toString(16)).slice(-2);
        try { return decodeURIComponent(s); } catch (e) { return "file"; }
    }

    var tabella = null;
    function crc32(b) {
        if (!tabella) {
            tabella = [];
            for (var n = 0; n < 256; n++) {
                var c = n;
                for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                tabella[n] = c >>> 0;
            }
        }
        var crc = 0xFFFFFFFF;
        for (var i = 0; i < b.length; i++) crc = tabella[(crc ^ b[i]) & 0xff] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function leggi(s) {
        if (typeof s !== "string") return null;
        var p = s.split("|");
        if (p.length !== 7 || p[0] !== "TOMO1") return null;
        var dati = base64(p[6]);
        var nome = base64(p[5]);
        if (dati === null || nome === null) return null;
        return { id: p[1], i: +p[2], n: +p[3], crc: +p[4], nome: testoUtf8(nome), dati: dati };
    }

    function Assemblatore() {
        this.id = null; this.n = 0; this.crc = 0; this.nome = ""; this.pezzi = {}; this.ricevuti = 0;
    }

    /** true se il QR era un pezzo nuovo. Un file diverso fa ricominciare. */
    Assemblatore.prototype.aggiungi = function (s) {
        var f = leggi(s);
        if (!f) return false;
        if (f.id !== this.id) {
            this.id = f.id; this.n = f.n; this.crc = f.crc; this.nome = f.nome; this.pezzi = {}; this.ricevuti = 0;
        }
        if (f.i < 0 || f.i >= this.n || this.pezzi[f.i]) return false;
        this.pezzi[f.i] = f.dati;
        this.ricevuti++;
        return true;
    };

    Assemblatore.prototype.completo = function () { return this.n > 0 && this.ricevuti === this.n; };

    Assemblatore.prototype.mancanti = function () {
        var m = [];
        for (var i = 0; i < this.n; i++) if (!this.pezzi[i]) m.push(i);
        return m;
    };

    /** Il file intero, o null se manca qualcosa o se il CRC non torna. */
    Assemblatore.prototype.file = function () {
        if (!this.completo()) return null;
        var tot = 0, i;
        for (i = 0; i < this.n; i++) tot += this.pezzi[i].length;
        var out = new Uint8Array(tot), pos = 0;
        for (i = 0; i < this.n; i++) { out.set(this.pezzi[i], pos); pos += this.pezzi[i].length; }
        return crc32(out) === this.crc ? out : null;
    };

    return { leggi: leggi, crc32: crc32, base64: base64, Assemblatore: Assemblatore };
})();
