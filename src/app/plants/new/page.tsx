import React from 'react';
import PlantFormClient from '../PlantFormClient';

export default function NewPlantPage() {
  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      <section className="section">
        <div style={{ display: 'flex', gap: '45px', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto', paddingTop: '15px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-eucalyptus)' }}>
              mi jardín
            </span>
          </div>
          <PlantFormClient />
        </div>
      </section>
    </main>
  );
}
