import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  return (
    <main>
      <p className="eyebrow">ALCEMY SIM · 工房のはじまり</p>
      <h1>小さな工房から、<br />大きな錬金術へ。</h1>
      <p className="intro">冒険者が持ち帰る素材。炉から生まれる品々。<br />ひとつの発見が、次の工房をつくる。</p>
      <section aria-labelledby="pillars-title">
        <h2 id="pillars-title">工房を育てる、3つの力</h2>
        <div className="pillars">
          <article><span aria-hidden="true">I</span><h3>冒険と調合</h3><p>冒険者を雇い、素材を集め、新しい品を生み出す。</p></article>
          <article><span aria-hidden="true">II</span><h3>設備と自動化</h3><p>工房に設備を置き、繰り返す仕事を仕組みに変える。</p></article>
          <article><span aria-hidden="true">III</span><h3>研究と成長</h3><p>知識を積み重ね、レシピと効率の可能性を広げる。</p></article>
        </div>
      </section>
      <details>
        <summary>最初のプレイ目標を見る</summary>
        <p>冒険者の派遣 → 素材の回収 → 設備での自動合成 → 販売 → 最初の研究、の一巡を目指します。</p>
      </details>
      <p className="status" role="status">開発準備中 · ゲーム機能は次の実装段階で追加します。</p>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Application root element is missing.');
createRoot(root).render(<StrictMode><App /></StrictMode>);
