import React from 'react'

export default function TAccount({ entries, title }) {
  if (!entries || entries.length === 0) {
    return <div className="t-account-empty">暂无分录数据</div>
  }

  const debitEntries = entries.filter(e => e.side === 'debit')
  const creditEntries = entries.filter(e => e.side === 'credit')
  
  const debitTotal = debitEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  const creditTotal = creditEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
  
  const isBalanced = Math.abs(debitTotal - creditTotal) < 0.01

  return (
    <div className="t-account-card">
      {title && <h3 className="t-account-title">{title}</h3>}
      <div className={`t-account ${isBalanced ? '' : 't-account-unbalanced'}`}>
        <div className="t-account-header">
          <span>借方 (Debit)</span>
          <span>贷方 (Credit)</span>
        </div>
        <div className="t-account-body">
          <div className="t-account-col debit">
            {debitEntries.map((e, i) => (
              <div key={`d-${i}`} className="t-entry-row">
                <span className="t-acc-name">{e.account}</span>
                <span className="t-acc-amt">{Number(e.amount).toFixed(2)}</span>
              </div>
            ))}
            <div className="t-total-row">
              <strong>合计:</strong>
              <strong>{debitTotal.toFixed(2)}</strong>
            </div>
          </div>
          <div className="t-account-col credit">
            {creditEntries.map((e, i) => (
              <div key={`c-${i}`} className="t-entry-row">
                <span className="t-acc-name">{e.account}</span>
                <span className="t-acc-amt">{Number(e.amount).toFixed(2)}</span>
              </div>
            ))}
            <div className="t-total-row">
              <strong>合计:</strong>
              <strong>{creditTotal.toFixed(2)}</strong>
            </div>
          </div>
        </div>
        {!isBalanced && (
          <div className="t-account-warning">
            ⚠️ 借贷不平衡！差额: {(debitTotal - creditTotal).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  )
}
