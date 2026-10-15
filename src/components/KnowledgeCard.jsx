import React from 'react'

export default function KnowledgeCard({ title, content, onClose }) {
  return (
    <div className="knowledge-card" role="alert">
      <div className="knowledge-header">
        <h4>{title}</h4>
        {onClose && (
          <button className="knowledge-close" onClick={onClose} aria-label="关闭知识卡片">
            ✕
          </button>
        )}
      </div>
      <div className="knowledge-content">
        <p>{content}</p>
      </div>
    </div>
  )
}
