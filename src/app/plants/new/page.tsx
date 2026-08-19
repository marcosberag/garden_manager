import React from 'react';
import PlantFormClient from '../PlantFormClient';

export default function NewPlantPage() {
  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      <section className="section">
        <div className="labeled-section">
          <div className="labeled-section-tag">
            <span className="field-label">
              mi jardín
            </span>
          </div>
          <PlantFormClient />
        </div>
      </section>
    </main>
  );
}
