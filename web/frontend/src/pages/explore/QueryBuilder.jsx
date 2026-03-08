import React from 'react'
import ProtocolStepper from '../../components/wrds/ProtocolStepper'

export default function QueryBuilder() {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Query Builder
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Build queries visually — no SQL required
        </p>
      </div>
      <ProtocolStepper />
    </div>
  )
}
