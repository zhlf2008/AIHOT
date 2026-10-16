// 针织服装潮流行业的分类体系、标签词表、主体名录与身份词典。
// 分类 key 与原框架兼容，站点上线后不要再改；显示标签和行业口径属于本站配置。
export const CATEGORIES = [
  {
    key: "ai-models",
    label: "秀场与趋势",
    feedLabel: "秀场与趋势",
    section: "趋势与秀场",
    guide:
      "全球时装周、针织系列发布、廓形与色彩趋势、消费者审美变化和可验证的潮流信号。单纯品牌宣传或没有具体趋势事实的灵感帖不归此类。",
  },
  {
    key: "ai-products",
    label: "纱线与工艺",
    feedLabel: "纱线与工艺",
    section: "材料与工艺",
    guide:
      "新纱线、纤维、染整、针型、编织结构、数字针织和生产工艺的发布或明确升级。单纯成衣上新归秀场与趋势，工厂经营新闻归行业动态。",
  },
  {
    key: "industry",
    label: "品牌与市场",
    feedLabel: "品牌与市场",
    section: "品牌与市场",
    guide:
      "品牌经营、渠道、零售数据、合作、并购、人事、供应链、市场规模与消费者行为等已发生的商业事件。品牌自我营销若没有可核验的新事实要压低评分。",
  },
  {
    key: "paper",
    label: "材料研究",
    feedLabel: "材料研究",
    section: "材料与工艺",
    guide:
      "以纤维科学、材料性能、循环再生、可持续染整、针织结构实验与可复现数据为核心的论文、技术报告或研究项目。普通产品公告不归此类。",
  },
  {
    key: "tip",
    label: "设计与技法",
    section: "设计与技法",
    guide:
      "可复用的针织设计方法、打版、花型开发、纱线选择、工艺参数和生产实践。单纯展示成衣或没有方法的品牌观点归观点。",
    commentary: true,
  },
  {
    key: "opinion",
    label: "行业观点",
    section: "设计与技法",
    guide:
      "设计师、买手、研究者或行业机构对针织趋势、材料、品牌策略和市场的解释、判断与预测。没有新事实支撑的口号和广告应压低评分。",
    commentary: true,
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  feedLabel?: string;
  section: string;
  guide: string;
  commentary?: true;
}>;
export const RELEASE: { category: string; tag: string; unit: string } | null = {
  category: "ai-models",
  tag: "系列发布",
  unit: "个新系列",
};
export const PLAIN_TERMS: readonly string[] = [
  "针织",
  "纱线",
  "毛衣",
  "时装周",
  "fw",
  "ss",
  "esg",
  "oem",
  "odm",
];
// 保留框架接口；类型语义由 prompts/content-understanding.md 映射到针织行业。
export const ITEM_TYPES = [
  "model_release",
  "product_launch",
  "tool_or_prompt",
  "research_paper",
  "industry_event",
  "opinion_analysis",
  "tutorial_explainer",
] as const;
export const CATEGORY_TAGS = [
  "系列发布",
  "材料/纱线",
  "工艺/设备",
  "研究/报告",
  "设计/技法",
  "趋势/现象",
  "行业观点",
  "评测/数据",
  "可持续/循环",
  "品牌/市场",
  "政策/标准",
  "非针织/通用",
  "其他",
] as const;
export const TOPIC_TAGS = [
  "秀场趋势",
  "色彩",
  "廓形",
  "花型",
  "纤维材料",
  "天然纤维",
  "再生纤维",
  "功能纱线",
  "染整",
  "横机",
  "圆机",
  "经编",
  "纬编",
  "手工针织",
  "数字针织",
  "供应链",
  "零售/电商",
  "可持续",
  "循环经济",
  "消费洞察",
] as const;
export const ENTITY_TAGS = [
  "Woolmark",
  "Lenzing",
  "Shima Seiki",
  "Santoni",
  "Textile Exchange",
  "Copenhagen Fashion Week",
  "Première Vision",
  "CFDA",
  "中国纺织工业联合会",
  "国际羊毛局",
  "Pitti Filati",
  "Stoll",
  "Nike",
  "Adidas",
] as const;
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  趋势: "趋势/现象",
  潮流: "趋势/现象",
  流行: "趋势/现象",
  趋势预测: "趋势/现象",
  现象: "趋势/现象",
  发布: "系列发布",
  新品: "系列发布",
  系列: "系列发布",
  时装周: "秀场趋势",
  纱线: "材料/纱线",
  面料: "材料/纱线",
  纤维: "纤维材料",
  材料: "纤维材料",
  再生: "再生纤维",
  环保: "可持续/循环",
  针法: "设计/技法",
  编织: "设计/技法",
  打版: "设计/技法",
  工艺: "工艺/设备",
  机器: "工艺/设备",
  设备: "工艺/设备",
  论文: "研究/报告",
  研究: "研究/报告",
  报告: "研究/报告",
  数据: "评测/数据",
  评测: "评测/数据",
  品牌: "品牌/市场",
  商业: "品牌/市场",
  市场: "品牌/市场",
  零售: "零售/电商",
  电商: "零售/电商",
  供应链: "供应链",
  观点: "行业观点",
  评论: "行业观点",
  政策: "政策/标准",
  标准: "政策/标准",
  法规: "政策/标准",
  教程: "设计/技法",
  技法: "设计/技法",
  实践: "设计/技法",
  合作: "品牌/市场",
  融资: "品牌/市场",
  并购: "品牌/市场",
};
export const ENTITIES: Record<
  string,
  {
    name: string;
    displayTag: string | null;
    aliases: string[];
    otherNames?: string[];
  }
> = {
  woolmark: {
    name: "The Woolmark Company",
    displayTag: "Woolmark",
    aliases: ["Woolmark", "国际羊毛局", "The Woolmark Company"],
  },
  lenzing: {
    name: "Lenzing",
    displayTag: "Lenzing",
    aliases: ["Lenzing", "兰精", "TENCEL"],
    otherNames: ["TENCEL Lyocell", "TENCEL Modal"],
  },
  "shima-seiki": {
    name: "Shima Seiki",
    displayTag: "Shima Seiki",
    aliases: ["Shima Seiki", "岛精机", "SHIMA SEIKI"],
  },
  santoni: {
    name: "Santoni",
    displayTag: "Santoni",
    aliases: ["Santoni", "圣东尼"],
  },
  "textile-exchange": {
    name: "Textile Exchange",
    displayTag: "Textile Exchange",
    aliases: ["Textile Exchange"],
  },
  "copenhagen-fashion-week": {
    name: "Copenhagen Fashion Week",
    displayTag: "Copenhagen Fashion Week",
    aliases: ["Copenhagen Fashion Week", "哥本哈根时装周"],
  },
  "premiere-vision": {
    name: "Première Vision",
    displayTag: "Première Vision",
    aliases: ["Première Vision", "Premiere Vision", "巴黎 Première Vision"],
  },
  cfda: {
    name: "CFDA",
    displayTag: "CFDA",
    aliases: ["CFDA", "美国时装设计师协会"],
  },
  "china-textile": {
    name: "中国纺织工业联合会",
    displayTag: "中国纺织工业联合会",
    aliases: ["中国纺织工业联合会", "中纺联"],
  },
  nike: { name: "Nike", displayTag: "Nike", aliases: ["Nike", "耐克"] },
  adidas: {
    name: "adidas",
    displayTag: "Adidas",
    aliases: ["adidas", "Adidas", "阿迪达斯"],
  },
  "pitti-filati": {
    name: "Pitti Immagine Filati",
    displayTag: "Pitti Filati",
    aliases: ["Pitti Filati", "Pitti Immagine Filati", "Pitti Filati 展"],
  },
  stoll: {
    name: "Stoll",
    displayTag: "Stoll",
    aliases: ["Stoll", "STOLL", "斯托尔"],
  },
};
export const IDENTITY_LEXICON: ReadonlyArray<{
  id: string;
  name: string;
  patterns: RegExp[];
}> = [
  {
    id: "woolmark",
    name: "The Woolmark Company",
    patterns: [/woolmark|国际羊毛局/i],
  },
  {
    id: "lenzing",
    name: "Lenzing / TENCEL",
    patterns: [/lenzing|兰精|tencel/i],
  },
  {
    id: "shima-seiki",
    name: "Shima Seiki",
    patterns: [/shima\s?seiki|岛精机/i],
  },
  { id: "santoni", name: "Santoni", patterns: [/santoni|圣东尼/i] },
  {
    id: "textile-exchange",
    name: "Textile Exchange",
    patterns: [/textile\s?exchange/i],
  },
  {
    id: "copenhagen-fashion-week",
    name: "Copenhagen Fashion Week",
    patterns: [/copenhagen\s+fashion\s+week|哥本哈根时装周/i],
  },
  {
    id: "premiere-vision",
    name: "Première Vision",
    patterns: [/premi(?:è|e)re\s+vision|巴黎.*premi(?:è|e)re/i],
  },
  { id: "cfda", name: "CFDA", patterns: [/\bCFDA\b|美国时装设计师协会/i] },
  {
    id: "china-textile",
    name: "中国纺织工业联合会",
    patterns: [/中国纺织工业联合会|中纺联/i],
  },
  { id: "nike", name: "Nike", patterns: [/\bnike\b|耐克/i] },
  { id: "adidas", name: "adidas", patterns: [/\badidas\b|阿迪达斯/i] },
  {
    id: "pitti-filati",
    name: "Pitti Immagine Filati",
    patterns: [/pitti\s+(?:immagine\s+)?filati/i],
  },
  { id: "stoll", name: "Stoll", patterns: [/\bstoll\b|斯托尔/i] },
];
export const PUBLISHER_DOMAINS: ReadonlyArray<{
  entityId: string;
  domains: readonly string[];
}> = [
  { entityId: "woolmark", domains: ["woolmark.com"] },
  { entityId: "lenzing", domains: ["lenzing.com", "tencel.com"] },
  { entityId: "shima-seiki", domains: ["shima-seiki.com"] },
  { entityId: "santoni", domains: ["santoni.com"] },
  { entityId: "textile-exchange", domains: ["textileexchange.org"] },
  {
    entityId: "copenhagen-fashion-week",
    domains: ["copenhagenfashionweek.com"],
  },
  { entityId: "premiere-vision", domains: ["premierevision.com"] },
  { entityId: "cfda", domains: ["cfda.com"] },
  { entityId: "china-textile", domains: ["cntac.org.cn"] },
  { entityId: "nike", domains: ["nike.com"] },
  { entityId: "adidas", domains: ["adidas-group.com", "adidas.com"] },
  { entityId: "pitti-filati", domains: ["pittimmagine.com"] },
  { entityId: "stoll", domains: ["stoll.com"] },
];
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{
  entityId: string;
  pattern: RegExp;
}> = [
  { entityId: "lenzing", pattern: /TENCEL(?:™|\u2122)?/i },
  { entityId: "woolmark", pattern: /The Woolmark Company/i },
  { entityId: "china-textile", pattern: /CNTAC/i },
];
