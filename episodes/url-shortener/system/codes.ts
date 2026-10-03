// Codes are the link's id written in base 62: link 1,000,000 becomes "4c92".
export const MAX_CODE_LENGTH = 7;
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function encode(id: number): string {
  let code = "";
  while (id > 0) {
    code = ALPHABET[id % 62] + code;
    id = Math.floor(id / 62);
  }
  return code;
}

export function decode(code: string): number | null {
  if (code.length === 0 || code.length > MAX_CODE_LENGTH) return null;
  let id = 0;
  for (const ch of code) {
    const digit = ALPHABET.indexOf(ch);
    if (digit === -1) return null;
    id = id * 62 + digit;
  }
  return id;
}
