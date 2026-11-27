// itch.io paketi için index.html (QA 2026-11-27 teknik rapor 03): dist/index.html claude.ai sayfa sözleşmesinde doctype'sız bir
// parçadır (check-dist bunu zorunlu tutar). itch dosyayı olduğu gibi iframe'e koyduğu için tarayıcı QUIRKS modunda açıyordu.
// Zip'e giden kopya tam belgeye sarılır (standart mod, geliştirmedeki Vite sayfasıyla aynı); dist/index.html'e dokunulmaz.
/** parça -> <!DOCTYPE html> belge. <title>/<meta>/<link>/<style> head'e, gerisi body'ye. Zaten belgeyse aynen döner. */
export function itchSarmala(parca) {
  if (/^\s*<!doctype html/i.test(parca)) return parca;
  const i = parca.lastIndexOf('</style>');
  const kes = i >= 0 ? i + '</style>'.length : 0;
  let bas = parca.slice(0, kes).trim(), govde = parca.slice(kes).trim();
  // charset ilk satırda olsun (tarayıcı ilk 1024 baytta arar; başlıktaki Türkçe harfler doğru okunsun)
  const cs = bas.match(/<meta charset="[^"]*">\s*/i);
  if (cs) bas = cs[0].trim() + '\n' + bas.replace(cs[0], '');
  return `<!DOCTYPE html>\n<html lang="tr">\n<head>\n${bas}\n</head>\n<body>\n${govde}\n</body>\n</html>\n`;
}
