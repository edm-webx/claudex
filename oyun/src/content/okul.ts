/** Okul (survey 2026-11-09): English lessons, every 10 answers is an exam; exam average = the player's overall okul score. */
export const OKUL_KELIME: [string, string][] = [
  ['çay', 'tea'], ['ekmek', 'bread'], ['su', 'water'], ['deniz', 'sea'], ['martı', 'seagull'], ['kedi', 'cat'], ['köpek', 'dog'], ['vapur', 'ferry'],
  ['iskele', 'pier'], ['müşteri', 'customer'], ['garson', 'waiter'], ['aşçı', 'cook'], ['mutfak', 'kitchen'], ['masa', 'table'], ['sandalye', 'chair'],
  ['hesap', 'bill'], ['bahşiş', 'tip'], ['sıcak', 'hot'], ['soğuk', 'cold'], ['tatlı', 'dessert'], ['peynir', 'cheese'], ['domates', 'tomato'],
  ['soğan', 'onion'], ['tavuk', 'chicken'], ['balık', 'fish'], ['para', 'money'], ['banka', 'bank'], ['okul', 'school'], ['öğretmen', 'teacher'],
  ['arkadaş', 'friend'], ['sabah', 'morning'], ['akşam', 'evening'], ['gece', 'night'], ['yağmur', 'rain'], ['güneş', 'sun'], ['köprü', 'bridge'],
  ['şehir', 'city'], ['sokak', 'street'], ['pazar', 'market'], ['kahve', 'coffee'], ['şeker', 'sugar'], ['tuz', 'salt'], ['kaşık', 'spoon'], ['bıçak', 'knife'],
  ['ev', 'house'], ['kapı', 'door'], ['pencere', 'window'], ['kitap', 'book'], ['kalem', 'pencil'], ['defter', 'notebook'], ['çanta', 'bag'], ['saat', 'clock'],
  ['anne', 'mother'], ['baba', 'father'], ['kardeş', 'sibling'], ['dede', 'grandfather'], ['nine', 'grandmother'], ['çocuk', 'child'], ['bebek', 'baby'],
  ['kırmızı', 'red'], ['mavi', 'blue'], ['yeşil', 'green'], ['sarı', 'yellow'], ['siyah', 'black'], ['beyaz', 'white'], ['turuncu', 'orange'], ['mor', 'purple'],
  ['elma', 'apple'], ['armut', 'pear'], ['muz', 'banana'], ['üzüm', 'grape'], ['çilek', 'strawberry'], ['karpuz', 'watermelon'], ['limon', 'lemon'], ['patates', 'potato'],
  ['süt', 'milk'], ['yumurta', 'egg'], ['pirinç', 'rice'], ['çorba', 'soup'], ['salata', 'salad'], ['bal', 'honey'], ['reçel', 'jam'], ['dondurma', 'ice cream'],
  ['kuş', 'bird'], ['at', 'horse'], ['inek', 'cow'], ['koyun', 'sheep'], ['tavşan', 'rabbit'], ['balina', 'whale'], ['yunus', 'dolphin'], ['kaplumbağa', 'turtle'],
  ['ağaç', 'tree'], ['çiçek', 'flower'], ['orman', 'forest'], ['dağ', 'mountain'], ['nehir', 'river'], ['göl', 'lake'], ['kum', 'sand'], ['taş', 'stone'],
  ['kar', 'snow'], ['rüzgar', 'wind'], ['bulut', 'cloud'], ['yıldız', 'star'], ['ay', 'moon'], ['gökyüzü', 'sky'], ['ateş', 'fire'], ['buz', 'ice'],
  ['araba', 'car'], ['otobüs', 'bus'], ['tren', 'train'], ['bisiklet', 'bicycle'], ['uçak', 'plane'], ['gemi', 'ship'], ['yol', 'road'], ['durak', 'stop'],
  ['doktor', 'doctor'], ['hasta', 'sick'], ['ilaç', 'medicine'], ['hastane', 'hospital'], ['polis', 'police'], ['itfaiye', 'fire brigade'], ['postane', 'post office'], ['mektup', 'letter'],
  ['büyük', 'big'], ['küçük', 'small'], ['hızlı', 'fast'], ['yavaş', 'slow'], ['yeni', 'new'], ['eski', 'old'], ['güzel', 'beautiful'], ['mutlu', 'happy'],
];
export const OKUL_SINAV = 10;   // answers per exam
/** EKO-03: günde en çok bu kadar ödüllü sınav; sonrası 'deneme' (ödülsüz, tecrübesiz). Ödül = puan x OKUL_ODUL_ADIM x min(1 + aşama x OKUL_ODUL_ASAMA, OKUL_ODUL_TAVAN). */
export const OKUL_GUNLUK_SINAV = 3, OKUL_ODUL_ADIM = 12, OKUL_ODUL_ASAMA = 0.1, OKUL_ODUL_TAVAN = 2;
/** Aynı kelime bu kadar soru boyunca geri gelmez. */
export const OKUL_TEKRAR_YOK = 5;
