export function nextOpcionLetra(index: number): string {
  let n = index;
  let letra = "";
  while (n > 0) {
    n--;
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26);
  }
  return letra;
}
