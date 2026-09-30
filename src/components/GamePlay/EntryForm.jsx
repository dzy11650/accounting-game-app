/**
 * 分录填写表单
 * 借/贷 科目选择 + 金额输入
 */
import React from 'react'

const ALL_ACCOUNTS = [
  '银行存款', '库存商品', '原材料', '生产成本', '固定资产', '累计折旧',
  '应收账款', '应付账款', '短期借款', '应付职工薪酬', '应付利息', '应交税费',
  '实收资本', '主营业务收入', '主营业务成本', '管理费用', '财务费用'
]

export default function EntryForm({ form, setForm }) {
  const update = (field, value) => setForm({ ...form, [field]: value })

  return (
    <div>
      <div className="flex gap8" style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 700, color: 'var(--primary-deep)', width: 30 }}>借</span>
        <select
          value={form.dAcc}
          onChange={(e) => update('dAcc', e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 8, border: '2px solid var(--line)' }}
        >
          <option value="">选择科目</option>
          {ALL_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="number"
          value={form.dAmt}
          placeholder="金额"
          onChange={(e) => update('dAmt', e.target.value)}
          style={{ width: 70, padding: 8, borderRadius: 8, border: '2px solid var(--line)' }}
        />
      </div>
      <div className="flex gap8">
        <span style={{ fontWeight: 700, color: 'var(--accent-deep)', width: 30 }}>贷</span>
        <select
          value={form.cAcc}
          onChange={(e) => update('cAcc', e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 8, border: '2px solid var(--line)' }}
        >
          <option value="">选择科目</option>
          {ALL_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input
          type="number"
          value={form.cAmt}
          placeholder="金额"
          onChange={(e) => update('cAmt', e.target.value)}
          style={{ width: 70, padding: 8, borderRadius: 8, border: '2px solid var(--line)' }}
        />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 6 }}>借贷金额需相等</div>
    </div>
  )
}
