import{normalizeDisplayFormat,supportDisplayFormat}from'./displayFormat.js';
export const isVisualFormatCompatible=(visual,support)=>Boolean(visual?.is_out_of_frame)||normalizeDisplayFormat(visual?.format_support)===normalizeDisplayFormat(supportDisplayFormat(support));
