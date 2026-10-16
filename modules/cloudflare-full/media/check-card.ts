import { SITE } from "@aihot/site";
/** Deployment validation card; never enters news, publication or selected-content tables. */
export const checkCard = {
  width: 1200, height: 630,
  tree: { type: "div", props: {
    style: { display: "flex", width: 1200, height: 630, padding: 72, flexDirection: "column", background: "#0a1012", color: "#e6eded", fontFamily: "Noto Sans SC" },
    children: [
      { type: "div", props: { style: { display: "flex", fontSize: 50, fontWeight: 700 }, children: SITE.name } },
      { type: "div", props: { style: { display: "flex", fontSize: 64, marginTop: 64 }, children: "中文分享图渲染验证" } },
      { type: "div", props: { style: { display: "flex", fontSize: 30, marginTop: 40 }, children: SITE.tagline } },
    ],
  } },
};
