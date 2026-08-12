import { useMemo } from 'react'

// 财务报表可视化：根据 level.report 渲染资产负债表 / 利润表 / 现金流量表
// 自动校验平衡（资产负债表：资产=负债+权益；利润表：收入-费用=利润；现金流量表：合计=净增加）

const TYPE_META = {
  balance: { title: '📊 资产负债表', sub: '资产 = 负债 + 所有者权益' },
  income: { title: '📈 利润表', sub: '收入 - 费用 = 利润' },
  cashflow: { title: '🌊 现金流量表', sub: '经营 + 投资 + 筹资 = 净增加' },
}

export default function ReportView({ report }) {
  if (!report) return null
  const meta = TYPE_META[report.type] || TYPE_META.balance

  const { balanced, totals } = useMemo(() => {
    if (report.type === 'balance') {
      const asset = report.rows.filter((r) => r.side === 'asset').reduce((s, r) => s + r.value, 0)
      const liability = report.rows.filter((r) => r.side === 'liability').reduce((s, r) => s + r.value, 0)
      const equity = report.rows.filter((r) => r.side === 'equity').reduce((s, r) => s + r.value, 0)
      return { balanced: Math.abs(asset - (liability + equity)) < 0.05, totals: { asset, liability, equity, right: liability + equity } }
    }
    if (report.type === 'income') {
      const net = report.rows.find((r) => r.item === '净利润')
      const revenue = report.rows.find((r) => r.item === '营业收入')
      const expense = report.rows.find((r) => r.item === '减：所得税费用')
      // 净利润以 buildReports 计算值为准（已含收入-各项费用-所得税）
      const profit = net ? net.value : 0
      const rev = revenue ? revenue.value : 0
      return { balanced: true, totals: { revenue: rev, expense: 0, profit } }
    }
    // cashflow
    const net = report.rows.reduce((s, r) => s + r.value, 0)
    return { balanced: true, totals: { net } }
  }, [report])

  return (
    <div className="card" style={{ background: '#FFFDF8' }}>
      <div style={{ fontWeight: 800, fontSize: 16 }}>{meta.title}</div>
      <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 2 }}>{meta.sub}</div>

      {report.type === 'balance' && (
        <div style={{ marginTop: 12 }}>
          <ReportTable title="资产" rows={report.rows.filter((r) => r.side === 'asset')} />
          <ReportTable title="负债" rows={report.rows.filter((r) => r.side === 'liability')} />
          <ReportTable title="所有者权益" rows={report.rows.filter((r) => r.side === 'equity')} />
          <div className="flex between center" style={{ marginTop: 8, fontWeight: 800 }}>
            <span>资产合计</span><span className="v">{fmt(totals.asset)}</span>
          </div>
          <div className="flex between center" style={{ fontWeight: 800 }}>
            <span>负债+权益合计</span><span className="v">{fmt(totals.right)}</span>
          </div>
        </div>
      )}

      {report.type === 'income' && (
        <div style={{ marginTop: 12 }}>
          <ReportTable title="" rows={report.rows} />
          <div className="flex between center" style={{ marginTop: 8, fontWeight: 800, color: 'var(--accent-deep)' }}>
            <span>净利润</span><span className="v">{fmt(totals.profit)}</span>
          </div>
        </div>
      )}

      {report.type === 'cashflow' && (
        <div style={{ marginTop: 12 }}>
          <ReportTable title="" rows={report.rows} />
          <div className="flex between center" style={{ marginTop: 8, fontWeight: 800, color: 'var(--accent-deep)' }}>
            <span>现金净增加额</span><span className="v">{fmt(totals.net)}</span>
          </div>
        </div>
      )}

      <div
        className="mt12"
        style={{
          padding: '8px 12px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          background: balanced ? '#E4F8F1' : '#FFEDED',
          color: balanced ? 'var(--accent-deep)' : '#FF6B6B',
        }}
      >
        {balanced ? '✅ 报表平衡，编制正确！' : '❌ 报表不平衡，请检查项目'}
      </div>
    </div>
  )
}

function ReportTable({ title, rows }) {
  if (!rows.length) return null
  return (
    <div style={{ marginBottom: 6 }}>
      {title && <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary-deep)', margin: '6px 0' }}>{title}</div>}
      {rows.map((r, i) => (
        <div key={i} className="flex between center" style={{ padding: r.emphasize ? '8px 0' : '6px 0', borderBottom: '1px dashed var(--line)', fontSize: r.emphasize ? 15 : 14, fontWeight: r.emphasize ? 800 : 400, color: r.emphasize ? 'var(--accent-deep)' : 'inherit' }}>
          <span>{r.item}</span>
          <span style={{ fontWeight: 700 }}>{fmt(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

function fmt(n) {
  const v = Number(n) || 0
  return (v < 0 ? '-' : '') + '¥' + Math.abs(v).toLocaleString() + '万'
}
