// Computes torrent IDs (as used by torrent clients to identify torrents) from magnet links and .torrent files.
// For v1 and hybrid torrents the ID is the SHA-1 info hash, for v2-only torrents it is the SHA-256 info hash
// truncated to 20 bytes.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToHex(str) {
    let bits = "";
    for (const c of str.toUpperCase()) {
        const v = BASE32_ALPHABET.indexOf(c);
        if (v < 0)
            return null;
        bits += v.toString(2).padStart(5, "0");
    }

    let hex = "";
    for (let i = 0; i + 4 <= bits.length; i += 4)
        hex += parseInt(bits.substring(i, i + 4), 2).toString(16);

    return hex;
}

function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function magnetTorrentIDs(link) {
    const ids = [];

    try {
        const params = new URLSearchParams(link.substring(link.indexOf("?") + 1));

        for (const xt of params.getAll("xt")) {
            let match = /^urn:btih:([0-9a-f]{40})$/i.exec(xt);
            if (match) {
                ids.push(match[1].toLowerCase());
                continue;
            }

            match = /^urn:btih:([a-z2-7]{32})$/i.exec(xt);
            if (match) {
                const hex = base32ToHex(match[1]);
                if (hex)
                    ids.push(hex);
                continue;
            }

            // v2: multihash, 0x12 = sha2-256, 0x20 = 32 bytes
            match = /^urn:btmh:1220([0-9a-f]{64})$/i.exec(xt);
            if (match)
                ids.push(match[1].substring(0, 40).toLowerCase());
        }
    }
    catch (e) {
        console.error(e);
    }

    return ids;
}

// Returns the [start, end) byte range of the value of the "info" key in the top-level bencoded dictionary.
function findInfoRange(bytes) {
    let pos = 0;

    const readInt = (terminator) => {
        let end = bytes.indexOf(terminator, pos);
        if (end < 0)
            throw new Error("Invalid bencode");
        const value = parseInt(new TextDecoder().decode(bytes.subarray(pos, end)));
        pos = end + 1;
        return value;
    };

    const readString = () => {
        const length = readInt(0x3A); // ':'
        const value = bytes.subarray(pos, pos + length);
        pos += length;
        return value;
    };

    const skipValue = () => {
        const c = bytes[pos];

        if (c === 0x69) { // 'i'
            pos++;
            readInt(0x65); // 'e'
        }
        else if (c === 0x6C || c === 0x64) { // 'l', 'd'
            pos++;
            while (bytes[pos] !== 0x65) {
                if (pos >= bytes.length)
                    throw new Error("Invalid bencode");
                skipValue();
            }
            pos++;
        }
        else if (c >= 0x30 && c <= 0x39)
            readString();
        else
            throw new Error("Invalid bencode");
    };

    if (bytes[pos++] !== 0x64)
        throw new Error("Invalid bencode");

    while (pos < bytes.length && bytes[pos] !== 0x65) {
        const key = new TextDecoder().decode(readString());
        const start = pos;
        skipValue();

        if (key === "info")
            return [start, pos];
    }

    return null;
}

export async function torrentFileTorrentIDs(buffer) {
    const ids = [];

    try {
        const bytes = new Uint8Array(buffer);
        const range = findInfoRange(bytes);

        if (range) {
            const info = bytes.subarray(range[0], range[1]);
            ids.push(bufferToHex(await crypto.subtle.digest("SHA-1", info)));
            ids.push(bufferToHex(await crypto.subtle.digest("SHA-256", info)).substring(0, 40));
        }
    }
    catch (e) {
        console.error(e);
    }

    return ids;
}
