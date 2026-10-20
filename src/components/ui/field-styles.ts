/**
 * Tokens visuais compartilhados por todos os campos do FSY (input, textarea,
 * select nativo e gatilho do select). Mantém aparência idêntica antes, durante
 * e depois da digitação, nos temas claro e escuro. Altura mínima de 44 px.
 * text-base no celular evita o zoom automático do iOS ao focar.
 */
export const FIELD_SURFACE =
  "w-full min-w-0 rounded-xl border border-slate-300 bg-white text-base text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow,background-color] duration-150 " +
  "placeholder:text-slate-500 hover:border-slate-400 " +
  "focus-visible:border-[#007DA5] focus-visible:ring-4 focus-visible:ring-[#007DA5]/15 " +
  "disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 " +
  "read-only:bg-slate-50 " +
  "aria-[invalid=true]:border-[#B42318] aria-[invalid=true]:ring-4 aria-[invalid=true]:ring-[#B42318]/12 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-400 dark:hover:border-slate-500 " +
  "dark:focus-visible:border-[#01B6D1] dark:focus-visible:ring-[#01B6D1]/20 " +
  "dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-400 dark:read-only:bg-slate-900/60 " +
  "dark:aria-[invalid=true]:border-[#FF8A7A] dark:aria-[invalid=true]:ring-[#FF8A7A]/20 md:text-sm";

export const FIELD_INPUT = `${FIELD_SURFACE} h-11 px-3.5`;
export const FIELD_TEXTAREA = `${FIELD_SURFACE} min-h-24 px-3.5 py-2.5 leading-relaxed`;
export const FIELD_SELECT = `${FIELD_SURFACE} h-11 appearance-none bg-no-repeat pl-3.5 pr-10 fsy-select-chevron`;
