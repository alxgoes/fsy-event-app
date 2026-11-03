/** Identidade da sessão definida pelo usuário; não altera lemas das companhias. */
export const EVENT_NAME = "FSY Sessão Ribeirão Preto 2";
export const EVENT_SHORT_NAME = "FSY Ribeirão Preto 2 — 2027";
export const EVENT_THEME_LEAD = "Alegrar-se em";
export const EVENT_THEME_FOCUS = "Cristo";
export const EVENT_THEME = `${EVENT_THEME_LEAD} ${EVENT_THEME_FOCUS}`;
export const EVENT_SCRIPTURE = "Filipenses 4:4";
export const EVENT_DATES = "06 a 10 de fevereiro de 2027";
export const EVENT_VALIDITY_SHORT = "06 a 10/02/2027";
export const STAFF_DAY_DATE = "05 de fevereiro de 2027";
export const EVENT_VENUE = "Ipê Park Hotel";
export const EVENT_CITY = "São José do Rio Preto";
export const EVENT_STATE = "SP";
export const EVENT_CITY_UF = `${EVENT_CITY} / ${EVENT_STATE}`;
export const EVENT_LOCATION_FULL = `${EVENT_VENUE} — ${EVENT_CITY_UF}`;
export const EVENT_DAY_DATES: Readonly<Record<string, string>> = {
  dia0: "2027-02-05",
  dia1: "2027-02-06",
  dia2: "2027-02-07",
  dia3: "2027-02-08",
  dia4: "2027-02-09",
  dia5: "2027-02-10",
};
export const EVENT_START_AT = `${EVENT_DAY_DATES.dia1}T08:00:00-03:00`;
export const EVENT_END_AT = `${EVENT_DAY_DATES.dia5}T23:59:59-03:00`;
