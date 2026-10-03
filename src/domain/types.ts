/** 日付はすべて端末の暦の 'YYYY-MM-DD'(時刻・時差を持たない) */
export type Ymd = string;

export type KigenKind = 'shomi' | 'shohi'; // 賞味期限 / 消費期限

export interface Category { id: string; name: string; color: string; builtin?: boolean }
export interface Place { id: string; name: string; builtin?: boolean }

/** よく買う食材(ワンタップ登録の元)。目安日数は買った日から数える */
export interface Preset {
  id: string;
  name: string;
  cat: string;
  place: string;
  days: number;
  kind: KigenKind;
  price: number; // 円。もったいない額の計算に使う。0=不明
  uses: number; // 登録した回数(並び順に使う)
  lastUsed?: string; // ISO
  custom?: boolean; // 利用者が作った
  hidden?: boolean;
}

export interface Item {
  id: string;
  name: string;
  cat: string;
  place: string;
  expiry: Ymd;
  kind: KigenKind;
  qty: number;
  price: number;
  presetId?: string;
  addedAt: string; // ISO
  batch: string; // 同じ登録操作で入れた品は同じ値(「前回と同じ」に使う)
  updatedAt: string; // ISO(共有ファイルの取り込みで新しい方を残す)
}

export type Outcome = 'used' | 'wasted';

export interface LogEntry {
  id: string;
  itemId: string;
  name: string;
  cat: string;
  price: number; // この記録で失った/使った額(個数分)
  qty: number;
  outcome: Outcome;
  date: Ymd;
  daysLeft: number; // 記録した日の残り日数(負=切れていた)
}

export interface ShopEntry { id: string; name: string; presetId?: string; done: boolean; addedAt: string; updatedAt: string }

export interface Settings {
  notify: boolean;
  notifyTime: string; // 'HH:MM'
  notifyDaysBefore: number[]; // 0=当日
  theme: string;
  fontScale: number;
  defaultPlace: string;
  deviceName: string;
}

export interface AppData {
  version: 1;
  items: Item[];
  presets: Preset[];
  cats: Category[];
  places: Place[];
  log: LogEntry[];
  shop: ShopEntry[];
  settings: Settings;
  deleted: string[]; // 消した品の id(共有ファイルの取り込みで生き返らせない)
  /** 「前回と同じ」用に、冷蔵庫から出した品のうち最後の登録の分だけ控えておく */
  lastBatchArchive?: Item[];
}
