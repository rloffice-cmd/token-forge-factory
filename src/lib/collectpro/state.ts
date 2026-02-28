/**
 * CollectPro — state shape, action union, initial state, and reducer.
 */

import type {
  CollectionItem,
  Partner,
  ChatMessage,
  SortConfig,
  ItemForm,
  ItemStatus,
  AIMode,
  Tab,
  ViewMode,
  UndoBuffer,
} from "./types";

export type State = {
  items:    CollectionItem[];
  partners: Partner[];
  loading:  boolean;
  tab:      Tab;
  franchise: boolean;
  viewMode: ViewMode;
  arena: { a: string | null; b: string | null };
  modal: string | null;
  showScanner: boolean;
  chat: { messages: ChatMessage[]; input: string; busy: boolean };
  market: { mode: AIMode; query: string; result: string; busy: boolean };
  inv: {
    search:    string;
    sort:      SortConfig;
    page:      number;
    showForm:  boolean;
    editId:    string | null;
    form:      ItemForm;
    selected:  string[];
  };
  partnerForm: { name: string; email: string };
  addingPartner: boolean;
  deleteTarget: string | null;
  undo:         UndoBuffer | null;
  isAdmin:      boolean;
};

export type Action =
  | { t: "LOAD_OK";    items: CollectionItem[]; partners: Partner[] }
  | { t: "RT_ITEM";    event: string; item: CollectionItem }
  | { t: "RT_PARTNER"; event: string; partner: Partner }
  | { t: "SET_TAB";    tab: Tab }
  | { t: "TOGGLE_FRANCHISE" }
  | { t: "SET_VIEW";   mode: ViewMode }
  | { t: "CHAT_INPUT"; v: string }
  | { t: "CHAT_MSG";   m: ChatMessage }
  | { t: "CHAT_BUSY";  v: boolean }
  | { t: "MKT_MODE";   v: AIMode }
  | { t: "MKT_QUERY";  v: string }
  | { t: "MKT_RESULT"; v: string }
  | { t: "MKT_BUSY";   v: boolean }
  | { t: "INV_SEARCH"; v: string }
  | { t: "INV_SORT";   s: SortConfig }
  | { t: "INV_PAGE";   n: number }
  | { t: "INV_FORM_SHOW"; show: boolean }
  | { t: "INV_FORM_EDIT"; id: string | null; form: ItemForm }
  | { t: "INV_FORM_PATCH"; p: Partial<ItemForm> }
  | { t: "INV_SEL_TOGGLE"; id: string }
  | { t: "INV_SEL_ALL"; ids: string[] }
  | { t: "INV_SEL_CLEAR" }
  | { t: "ARENA_SET";  slot: "a" | "b"; id: string | null }
  | { t: "ARENA_CLEAR" }
  | { t: "SET_MODAL";    id: string | null }
  | { t: "SET_SCANNER";  v: boolean }
  | { t: "PF_PATCH";   p: Partial<State["partnerForm"]> }
  | { t: "PF_BUSY";    v: boolean }
  | { t: "DEL_TARGET"; id: string | null }
  | { t: "UNDO_SET";   u: UndoBuffer | null }
  | { t: "SET_ADMIN";  v: boolean };

/** Items per page in the inventory table */
export const PAGE = 25;

export function today() { return new Date().toISOString().slice(0, 10); }

export function emptyForm(partnerId: string): ItemForm {
  return {
    name: "", card_set: "", franchise: "", condition: "NM",
    buy_price: "", grading_cost: "0", market_price: "",
    sell_price: "", sold_at: "",
    buy_date: today(), status: "active" as ItemStatus, partner_id: partnerId,
    notes: "", image_url: "", psa_grade: "",
  };
}

export const INIT: State = {
  items: [], partners: [], loading: true,
  tab: "brain", franchise: false, viewMode: "cards",
  arena: { a: null, b: null }, modal: null, showScanner: false,
  chat:   { messages: [], input: "", busy: false },
  market: { mode: "market", query: "", result: "", busy: false },
  inv: {
    search: "", sort: { field: "buy_date", dir: "desc" },
    page: 1, showForm: false, editId: null,
    form: emptyForm(""), selected: [],
  },
  partnerForm: { name: "", email: "" }, addingPartner: false,
  deleteTarget: null, undo: null, isAdmin: false,
};

export function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "LOAD_OK":
      return { ...s, loading: false, items: a.items, partners: a.partners };

    case "RT_ITEM":
      switch (a.event) {
        case "INSERT": return { ...s, items: [a.item, ...s.items.filter(i => i.id !== a.item.id)] };
        case "UPDATE": return { ...s, items: s.items.map(i => i.id === a.item.id ? a.item : i) };
        case "DELETE": return { ...s, items: s.items.filter(i => i.id !== a.item.id) };
        default: return s;
      }

    case "RT_PARTNER":
      switch (a.event) {
        case "INSERT":
          return { ...s, partners: [...s.partners, a.partner].sort((a, b) => a.name.localeCompare(b.name, "he")) };
        case "UPDATE":
          return { ...s, partners: s.partners.map(p => p.id === a.partner.id ? a.partner : p) };
        case "DELETE":
          return { ...s, partners: s.partners.filter(p => p.id !== a.partner.id) };
        default: return s;
      }

    case "SET_TAB":          return { ...s, tab: a.tab };
    case "TOGGLE_FRANCHISE": return { ...s, franchise: !s.franchise };
    case "SET_VIEW":         return { ...s, viewMode: a.mode };

    case "CHAT_INPUT": return { ...s, chat: { ...s.chat, input: a.v } };
    case "CHAT_MSG":   return { ...s, chat: { ...s.chat, messages: [...s.chat.messages, a.m] } };
    case "CHAT_BUSY":  return { ...s, chat: { ...s.chat, busy: a.v } };

    case "MKT_MODE":   return { ...s, market: { ...s.market, mode: a.v } };
    case "MKT_QUERY":  return { ...s, market: { ...s.market, query: a.v } };
    case "MKT_RESULT": return { ...s, market: { ...s.market, result: a.v } };
    case "MKT_BUSY":   return { ...s, market: { ...s.market, busy: a.v } };

    case "INV_SEARCH":    return { ...s, inv: { ...s.inv, search: a.v, page: 1 } };
    case "INV_SORT":      return { ...s, inv: { ...s.inv, sort: a.s } };
    case "INV_PAGE":      return { ...s, inv: { ...s.inv, page: a.n } };
    case "INV_FORM_SHOW": return { ...s, inv: { ...s.inv, showForm: a.show } };
    case "INV_FORM_EDIT": return { ...s, inv: { ...s.inv, editId: a.id, form: a.form, showForm: true } };
    case "INV_FORM_PATCH": return { ...s, inv: { ...s.inv, form: { ...s.inv.form, ...a.p } } };

    case "INV_SEL_TOGGLE": {
      const sel = s.inv.selected;
      return {
        ...s,
        inv: {
          ...s.inv,
          selected: sel.includes(a.id) ? sel.filter(id => id !== a.id) : [...sel, a.id],
        },
      };
    }
    case "INV_SEL_ALL":   return { ...s, inv: { ...s.inv, selected: a.ids } };
    case "INV_SEL_CLEAR": return { ...s, inv: { ...s.inv, selected: [] } };

    case "ARENA_SET":   return { ...s, arena: { ...s.arena, [a.slot]: a.id } };
    case "ARENA_CLEAR": return { ...s, arena: { a: null, b: null } };
    case "SET_MODAL":   return { ...s, modal: a.id };
    case "SET_SCANNER": return { ...s, showScanner: a.v };

    case "PF_PATCH": return { ...s, partnerForm: { ...s.partnerForm, ...a.p } };
    case "PF_BUSY":  return { ...s, addingPartner: a.v };

    case "DEL_TARGET": return { ...s, deleteTarget: a.id };
    case "UNDO_SET":   return { ...s, undo: a.u };
    case "SET_ADMIN":  return { ...s, isAdmin: a.v };

    default: return s;
  }
}
