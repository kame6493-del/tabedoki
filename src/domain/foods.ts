import type { Category, KigenKind, Place, Preset } from './types';

/**
 * 食材ごとの「買ってから何日くらい」の目安。
 * これはタベドキ独自の目安値で、公的機関が食品ごとの日数を示したものではない
 * (消費者庁・農林水産省・厚生労働省の公開資料に、家庭向けの食品別日数の一覧は見つからなかった。RELEASE.md 参照)。
 * 袋や箱に書かれた期限があれば、そちらが優先。登録した後でいつでも変えられる。
 * 保存の温度は厚生労働省「家庭でできる食中毒予防の6つのポイント」(冷蔵庫は10℃以下、冷凍庫は-15℃以下、早めに使いきる)に沿う前提。
 * 値段は「もったいない額」を出すための仮の値で、利用者が変えられる。
 */
export const BUILTIN_CATS: Category[] = [
  { id: 'veg', name: '野菜', color: '#4f9a52', builtin: true },
  { id: 'fruit', name: '果物', color: '#e07a2f', builtin: true },
  { id: 'meat', name: '肉', color: '#c8463d', builtin: true },
  { id: 'fish', name: '魚', color: '#3a7bbf', builtin: true },
  { id: 'dairy', name: '卵・乳製品', color: '#c9a227', builtin: true },
  { id: 'soy', name: '豆腐・納豆', color: '#9a7b4f', builtin: true },
  { id: 'deli', name: '惣菜・パン', color: '#b0623b', builtin: true },
  { id: 'season', name: '調味料', color: '#7a5aa6', builtin: true },
  { id: 'drink', name: '飲み物', color: '#2f9a96', builtin: true },
  { id: 'frozen', name: '冷凍食品', color: '#5a7fa6', builtin: true },
  { id: 'other', name: 'その他', color: '#7d8088', builtin: true },
];

export const BUILTIN_PLACES: Place[] = [
  { id: 'fridge', name: '冷蔵', builtin: true },
  { id: 'veg', name: '野菜室', builtin: true },
  { id: 'freezer', name: '冷凍', builtin: true },
  { id: 'pantry', name: '常温', builtin: true },
];

type Row = [name: string, cat: string, place: string, days: number, kind: KigenKind, price: number];

// 名前・分類・置き場所・目安日数・期限の種類・仮の値段
const ROWS: Row[] = [
  ['牛乳', 'dairy', 'fridge', 7, 'shomi', 230],
  ['卵', 'dairy', 'fridge', 14, 'shomi', 280],
  ['ヨーグルト', 'dairy', 'fridge', 10, 'shomi', 180],
  ['チーズ', 'dairy', 'fridge', 21, 'shomi', 300],
  ['バター', 'dairy', 'fridge', 60, 'shomi', 450],
  ['生クリーム', 'dairy', 'fridge', 5, 'shomi', 300],
  ['豆腐', 'soy', 'fridge', 5, 'shohi', 90],
  ['納豆', 'soy', 'fridge', 7, 'shomi', 100],
  ['油揚げ', 'soy', 'fridge', 5, 'shohi', 100],
  ['豆乳', 'soy', 'fridge', 30, 'shomi', 200],
  ['鶏もも肉', 'meat', 'fridge', 2, 'shohi', 450],
  ['鶏むね肉', 'meat', 'fridge', 2, 'shohi', 350],
  ['豚こま肉', 'meat', 'fridge', 3, 'shohi', 400],
  ['豚バラ肉', 'meat', 'fridge', 3, 'shohi', 450],
  ['ひき肉', 'meat', 'fridge', 1, 'shohi', 400],
  ['牛こま肉', 'meat', 'fridge', 3, 'shohi', 600],
  ['ハム', 'meat', 'fridge', 7, 'shomi', 250],
  ['ベーコン', 'meat', 'fridge', 7, 'shomi', 250],
  ['ウインナー', 'meat', 'fridge', 10, 'shomi', 300],
  ['刺身', 'fish', 'fridge', 1, 'shohi', 600],
  ['鮭の切り身', 'fish', 'fridge', 2, 'shohi', 400],
  ['干物', 'fish', 'fridge', 3, 'shohi', 400],
  ['ちくわ', 'fish', 'fridge', 7, 'shomi', 120],
  ['キャベツ', 'veg', 'veg', 10, 'shomi', 200],
  ['レタス', 'veg', 'veg', 4, 'shomi', 180],
  ['きゅうり', 'veg', 'veg', 5, 'shomi', 150],
  ['トマト', 'veg', 'veg', 5, 'shomi', 250],
  ['にんじん', 'veg', 'veg', 14, 'shomi', 150],
  ['大根', 'veg', 'veg', 7, 'shomi', 180],
  ['ほうれん草', 'veg', 'veg', 3, 'shomi', 180],
  ['小松菜', 'veg', 'veg', 3, 'shomi', 150],
  ['ブロッコリー', 'veg', 'veg', 4, 'shomi', 200],
  ['ピーマン', 'veg', 'veg', 7, 'shomi', 150],
  ['なす', 'veg', 'veg', 5, 'shomi', 200],
  ['長ねぎ', 'veg', 'veg', 7, 'shomi', 150],
  ['もやし', 'veg', 'fridge', 2, 'shomi', 40],
  ['しめじ', 'veg', 'fridge', 5, 'shomi', 100],
  ['玉ねぎ', 'veg', 'pantry', 30, 'shomi', 200],
  ['じゃがいも', 'veg', 'pantry', 30, 'shomi', 250],
  ['しょうが', 'veg', 'fridge', 14, 'shomi', 120],
  ['バナナ', 'fruit', 'pantry', 4, 'shomi', 200],
  ['りんご', 'fruit', 'veg', 21, 'shomi', 150],
  ['みかん', 'fruit', 'pantry', 10, 'shomi', 400],
  ['いちご', 'fruit', 'fridge', 3, 'shomi', 500],
  ['食パン', 'deli', 'pantry', 4, 'shomi', 180],
  ['お惣菜', 'deli', 'fridge', 1, 'shohi', 400],
  ['お弁当', 'deli', 'fridge', 1, 'shohi', 500],
  ['ゆで麺', 'deli', 'fridge', 5, 'shohi', 120],
  ['漬物', 'deli', 'fridge', 14, 'shomi', 200],
  ['キムチ', 'deli', 'fridge', 14, 'shomi', 300],
  ['マヨネーズ', 'season', 'fridge', 30, 'shomi', 300],
  ['ケチャップ', 'season', 'fridge', 30, 'shomi', 200],
  ['ドレッシング', 'season', 'fridge', 30, 'shomi', 300],
  ['味噌', 'season', 'fridge', 90, 'shomi', 350],
  ['ジュース', 'drink', 'fridge', 7, 'shomi', 200],
  ['麦茶(作り置き)', 'drink', 'fridge', 2, 'shomi', 0],
  ['冷凍うどん', 'frozen', 'freezer', 60, 'shomi', 250],
  ['冷凍餃子', 'frozen', 'freezer', 60, 'shomi', 300],
  ['冷凍ごはん', 'frozen', 'freezer', 30, 'shomi', 0],
  ['冷凍した肉', 'frozen', 'freezer', 30, 'shomi', 400],
  ['アイス', 'frozen', 'freezer', 180, 'shomi', 300],
];

/** 最初に「よく買う」に並べる順(よくある買い物の順) */
const STARTERS = ['牛乳', '卵', '納豆', '豆腐', '鶏もも肉', '豚こま肉', 'キャベツ', 'もやし', 'ヨーグルト', '食パン', 'トマト', 'バナナ'];

export function builtinPresets(): Preset[] {
  return ROWS.map(([name, cat, place, days, kind, price], i) => ({
    id: `p${i + 1}`,
    name, cat, place, days, kind, price,
    // 最初の並び: STARTERS の順に小さな下駄をはかせる(1回でも登録すればそちらが勝つ)
    uses: 0,
    lastUsed: undefined,
    starter: STARTERS.indexOf(name),
  })).map(({ starter, ...p }) => ({ ...p, uses: starter >= 0 ? (STARTERS.length - starter) / 100 : 0 }));
}
