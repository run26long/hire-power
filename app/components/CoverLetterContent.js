'use client'

export default function CoverLetterContent({ clData, onUpdate, selectedTemplate, selectedFont, selectedSize }) {

  function update(field, value) {
    onUpdate({ ...clData, [field]: value })
  }

  function updateBullet(index, value) {
    const newBullets = [...(clData.bullets || [])]
    newBullets[index] = value
    onUpdate({ ...clData, bullets: newBullets })
  }

  function addBullet() {
    onUpdate({ ...clData, bullets: [...(clData.bullets || []), ''] })
  }

  function removeBullet(index) {
    onUpdate({ ...clData, bullets: (clData.bullets || []).filter((_, i) => i !== index) })
  }

  const base = selectedSize || 11
  const font = selectedFont || 'Lato'
  const contactLine = [clData.location, clData.phone, clData.email, clData.linkedin].filter(Boolean).join(' | ')
  const bulletsIntro = clData.bulletsIntro || 'Highlights of how my experience aligns with this role include:'

  const editableClass = 'cursor-text hover:bg-purple-50 rounded px-1 -mx-1 outline-none focus:bg-purple-50 focus:ring-1 focus:ring-purple-300'

  const body = {
    fontFamily: font,
    fontSize: `${base}pt`,
    lineHeight: '1.3',
    color: '#1a1a1a',
  }

  return (
    <div style={{
      padding: '57px',
      fontFamily: font,
      fontSize: `${base}pt`,
      lineHeight: '1.6',
      color: '#1a1a1a',
      minHeight: '1056px',
      boxSizing: 'border-box',
      backgroundColor: '#fff',
    }}>

      {/* Header — Current style: centered name, rules sandwiching contact */}
      <div style={{ textAlign: 'center', marginBottom: 0 }}>
        <div
          contentEditable
          suppressContentEditableWarning
          className={editableClass}
          style={{
            fontFamily: font,
            fontSize: `${base + 6}pt`,
            fontWeight: '700',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#1a1a1a',
            marginBottom: '4px',
            lineHeight: '1.1',
            display: 'block',
          }}
          onBlur={e => update('candidateName', e.currentTarget.textContent)}
        >{clData.candidateName || 'Your Name'}</div>
      </div>

      <hr style={{ border: 'none', borderBottom: '1px solid #bbb', margin: '0' }} />

      <div
        contentEditable
        suppressContentEditableWarning
        className={editableClass}
        style={{
          fontFamily: font,
          fontSize: `${base - 1}pt`,
          color: '#555',
          textAlign: 'center',
          lineHeight: '1.3',
          letterSpacing: '0.2px',
          padding: '6px 0',
          display: 'block',
        }}
        onBlur={e => {
          const parts = e.currentTarget.textContent.split('|').map(p => p.trim())
          onUpdate({
            ...clData,
            location: parts[0] || clData.location,
            phone: parts[1] || clData.phone,
            email: parts[2] || clData.email,
            linkedin: parts[3] || clData.linkedin,
          })
        }}
      >{contactLine || 'City, State | Phone | Email'}</div>

      <hr style={{ border: 'none', borderBottom: '1px solid #bbb', margin: '0 0 20px 0' }} />

      {/* Date */}
      <div style={{ ...body, marginBottom: '16px' }}>
        <span
          contentEditable
          suppressContentEditableWarning
          className={editableClass}
          onBlur={e => update('date', e.currentTarget.textContent)}
        >{clData.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
      </div>

      {/* Company + Re line */}
      <div style={{ ...body, marginBottom: '20px' }}>
        <div
          contentEditable
          suppressContentEditableWarning
          className={editableClass}
          style={{ display: 'block', marginBottom: '4px' }}
          onBlur={e => update('companyName', e.currentTarget.textContent)}
        >{clData.companyName || 'Company Name'}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ color: '#555' }}>Re:</span>
          <span
            contentEditable
            suppressContentEditableWarning
            className={editableClass}
            onBlur={e => update('jobTitle', e.currentTarget.textContent)}
          >{clData.jobTitle || 'Position Title'}</span>
        </div>
      </div>

      {/* Opening paragraph */}
      <p
        contentEditable
        suppressContentEditableWarning
        className={editableClass}
        style={{ ...body, display: 'block', marginBottom: '16px' }}
        onBlur={e => update('opening', e.currentTarget.textContent)}
      >{clData.opening || 'Opening paragraph...'}</p>

      {/* Bullets intro */}
      <p
        contentEditable
        suppressContentEditableWarning
        className={editableClass}
        style={{ ...body, display: 'block', marginBottom: '10px' }}
        onBlur={e => update('bulletsIntro', e.currentTarget.textContent)}
      >{bulletsIntro}</p>

      {/* Bullets */}
      <div style={{ marginBottom: '20px', paddingLeft: '8px' }}>
        {(clData.bullets || []).map((bullet, i) => (
          <div key={i} className="group/bullet flex items-start gap-2 mb-3 relative">
            <span style={{ ...body, flexShrink: 0, marginTop: '1px' }}>•</span>
            <p
              contentEditable
              suppressContentEditableWarning
              className={`${editableClass} flex-1`}
              style={{ ...body, display: 'block' }}
              onBlur={e => updateBullet(i, e.currentTarget.textContent)}
            >{bullet}</p>
            <button
              onClick={() => removeBullet(i)}
              className="opacity-0 group-hover/bullet:opacity-100 text-red-400 hover:text-red-600 text-xs px-1 flex-shrink-0 transition-opacity"
              title="Remove bullet"
            >🗑️</button>
          </div>
        ))}
        <button
          onClick={addBullet}
          className="text-purple-600 text-xs hover:text-purple-700 mt-1 opacity-50 hover:opacity-100"
        >+ Add bullet</button>
      </div>

      {/* Closing */}
      <p
        contentEditable
        suppressContentEditableWarning
        className={editableClass}
        style={{ ...body, display: 'block', marginBottom: '32px' }}
        onBlur={e => update('closing', e.currentTarget.textContent)}
      >{clData.closing || 'Closing paragraph...'}</p>

      {/* Signature */}
      <div style={body}>
        <div style={{ marginBottom: '4px' }}>Sincerely,</div>
        <div style={{ marginTop: '24px', fontWeight: '600' }}>
          <span
            contentEditable
            suppressContentEditableWarning
            className={editableClass}
            onBlur={e => update('candidateName', e.currentTarget.textContent)}
          >{clData.candidateName || 'Your Name'}</span>
        </div>
      </div>

    </div>
  )
}