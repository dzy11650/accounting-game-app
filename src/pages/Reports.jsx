import { useState } from 'react'
import { COMPANIES } from '../data/companies.js'
import { createCompany, applyBusiness, monthEnd, buildReports, applyFunding, applyTaxType, vatOnSale, vatOnPurchase, settleTax, DIFFICULTY } from '../lib/engine.js'
import ReportView from '../components/ReportView.jsx'

// 财务报表中心：选公司快速生成一套示例报表（大图展示）
export default function Reports() {
  const [coId, setCoId] = useState('shop')
  const [diffId, setDiffId] = useState('easy')
  const [report, setReport] = useState(null)

  const generate = () => {
    const co = COMPANIES.find((c) => c.id === coId)
    const s = createCompany(coId, diffId)
    applyFunding(s, 'full')
    applyTaxType(s, 'small')
    // 购置固定资产
    co.fixedAssets.forEach((fa) => applyBusiness(s, [
      { side: 'debit', account: '固定资产', amount: fa.value },
      { side: 'credit', account: '银行存款', amount: fa.value },
    ], `购置${fa.name}`))
    // 跑 2 个月示例业务
    for (let m = 1; m <= 2; m++) {
      const ds = co.economics.dealSize * s.scale
      applyBusiness(s, vatOnPurchase(s, ds, false).entries, '进货')
      applyBusiness(s, vatOnSale(s, ds, co.revenueAccount).entries, '卖货')
      applyBusiness(s, co.costOfSale(ds * (1 - co.economics.margin)), '结转成本')
      applyBusiness(s, [{ side: 'debit', account: '管理费用-房租', amount: co.economics.rent * s.scale }, { side: 'credit', account: '银行存款', amount: co.economics.rent * s.scale }], '付房租')
      applyBusiness(s, [{ side: 'debit', account: '管理费用-工资', amount: co.economics.salary * s.scale }, { side: 'credit', account: '应付职工薪酬', amount: co.economics.salary * s.scale }], '计提工资')
      monthEnd(s)
    }
    settleTax(s)
    setReport(buildReports(s))
  }

  return (
    <div className="page fade-in">
      <div className="card">
        <div className="section-title" style={{ marginTop: 0 }}>📊 财务报表中心</div>
        <div className="sub-title">选公司类型，一键生成真实三张表（含平衡校验）</div>
        <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
          {COMPANIES.map((c) => (
            <button key={c.id} className={`btn ghost ${coId === c.id ? '' : 'ghost'}`} style={{ width: 'auto', padding: '8px 12px' }} onClick={() => setCoId(c.id)}>{c.emoji} {c.name}</button>
          ))}
        </div>
        <div className="flex gap8 mt12">
          {Object.values(DIFFICULTY).map((d) => (
            <button key={d.id} className="btn ghost" style={{ width: 'auto', padding: '8px 12px' }} onClick={() => setDiffId(d.id)}>{d.name}</button>
          ))}
        </div>
        <button className="btn mt12" onClick={generate}>🪄 生成报表</button>
      </div>

      {report ? (
        <>
          <ReportView report={report.balance} />
          <ReportView report={report.income} />
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-soft)' }}>
          点击「生成报表」查看资产负债表与利润表
        </div>
      )}
    </div>
  )
}
