# 交接文档 · 分享卡片终轮定向小修（nightflight / steam）

日期：2026-11-11　分支：design/share-cards-v2（未 commit）
范围：仅 `themes/nightflight/interfaces.css`、`themes/steam/interfaces.css` 的 CARD CHARACTER 块。
自检：`node tools/share-shots.js --themes=nightflight,steam --out=../_shots/share-v4`
结果：六张卡 overflow 全 0；导出尺寸 poster 1600×900 / dossier 1200×1500 / score 1600×840 精确匹配。

## nightflight（4 条）

1. **翻牌格母题落地（poster/dossier/score 三张）**
   `.sc-hours` 深蓝翻牌块（#0a0f14 底 + 1px #1c3348 边 + 2px 圆角）本就存在，缺分格。
   现补两处：a) `linear-gradient` 上下半明暗差（上半 rgba(255,255,255,.05)、下半 rgba(0,0,0,.24)）模拟翻牌两半；b) `::before` 一条 1px rgba(255,255,255,.1) 中缝横线，`top: calc(10px + (100% - 26px) / 2)` 精确贯穿数字几何中心（不吃上下 padding）。三张共用，均生效。
2. **score 补齐成套母题（票根 + 条码 + 航迹）**
   score 的整卡 sheet 是不透明深蓝屏（inset:0），背景 SVG 全被盖住，所以此前"没画航迹"。
   用 score 独占的 `.sc-deco::before/::after`（deco z4，在 sheet z3 之上，右栏数据区之外）补：
   - 航线：viewBox 1600×840 的 SVG 虚线（#d9ff45，2.5px + 9px glow 层）+ 三枚航点（r3.5 实心 + r9 晕），贴舷窗左缘绕行（y300..500 段 x≤50，与舷窗晕环保持 ≥7px 间距）；
   - 票根窄条：左下 572×82 米白纸条（x72, y718），内含橄榄色票签（#6f8a12 14px 方块）、竖向撕口虚线（x84）、横置条码（172×44，与 poster 同款 repeating 渐变）、航班行 `NF-0101 · SEAT 14A · GATE C07`（11px mono）。三张读作一族。
3. **荧光航线提亮（poster/dossier 共用的背景 SVG）**
   三处相同 data-URI 全部替换：航线由单层 stroke 2px / opacity .85 改为双层——glow 层 stroke 9px / opacity .2 + 主线 stroke 2.5px / opacity 1。poster（cover 缩放 1:1）提升最明显，dossier（1.5x）同步更亮。
4. **poster 票根文字距中缝 ≥16px**
   `.sc-sheet::after` 由 `right:30 / width:120` 改为 `right:26 / width:106`：文字左缘距撕口虚线 24px（撕口在 sheet 右缘 156px 处）。

## steam（3 条）

1. **蓝轨贯通 + 端帽（三张统一）**
   三条轨（poster `.sc-main::before`、dossier `.sc-deco::before`、score `.sc-deco::before`）统一改为 10px 高盒子、5 层背景，自上而下：
   左端帽 `linear-gradient(#1a9fff,#1a9fff) 0 0 / 3px 10px` → 右端帽 `100% 0` → 填充头光点 `radial-gradient(...) 62% 50% / 12px 12px` → 蓝段 `linear-gradient(90deg,#0f5f9e,#1a9fff 70%,#7fd0ff) 0 3px / 62% 4px` → 暗轨 `linear-gradient(#262b34,#262b34) 0 3px / 100% 4px` 画满整条。
   poster `top:-20→-23`、dossier `top:784→781`、score `bottom:40→37`（轨中线位置不变），并去掉原 inset 阴影（避免在 10px 盒上横切端帽）。
   score 页脚下方那条"悬空横蓝线"即此轨的蓝段——收口后读作完整进度仪，问题 #3 由本条一并解决。
2. **dossier 270px 空带**
   `.sc-main::after` 状态行由 `top:42px` 改 `top:auto; bottom:306px`（bottom 锚定随数据区走），状态行底距 sc-score 分隔线约 30px，空带收掉。
3. 见上（score 残留线 = `.sc-deco::before` 蓝段，已收口）。

## 注意事项

- dossier 票根文字距撕口 8px 未改（复核只列了 poster，属 PASS 项，未动）。
- score 竖向蓝主线（`.sc-sheet::before`）非进度轨，未动。
- steam 三个伪元素轨道的 `bottom/top` 值与卡片内容高度耦合，若后续改 dossier `sc-facts` 行数需回看状态行 `bottom:306px` 是否仍贴合。
- 自检产物在 `../_shots/share-v4/{nightflight,steam}/`（卡 + dialog 各 3 张）；过程中的基线与放大裁剪图已删除。
- 其余主题（grimoire/broadcast/aurum/zerohour/riot/riso/codex/mnemo/dusk/summer）、src/、.js、theme.json 均未触碰；工作区里它们的改动来自并行任务。
