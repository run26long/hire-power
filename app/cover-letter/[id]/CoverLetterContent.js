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
    const newBullets = [...(clData.bullets || []), '']
    onUpdate({ ...clData, bullets: newBullets })
  }

  function removeBullet(index) {
    const newBullets = (clData.bullets || []).filter((_, i) => i !== index)
    onUpdate({ ...clData, bullets: newBullets })
  }

  // Match resume template header styles
  const isSerifTemplate = ['crisp', 'prestige', 'signature', 'vibe'].includes(selectedTemplate)
  const isBoldDivider = ['sharp', 'command', 'edge'].includes(selectedTemplate)

  const headerStyle = {
    fontFamily: selectedFont,
    paddingBottom: '12px',
    marginBottom: '16px',
    borderBottom: isBoldDivider ? '2px solid #1a1a1a' : '1px solid #d1d5db',
  }

  const nameStyle = {
    fontSize: `${(selectedSize || 11) + 6}pt`,
    fontWeight: '700',
    letterSpacing: selectedTemplate === 'sharp' ? '0.05em' : '0',
    textTransform: selectedTemplate === 'sharp' ? 'uppercase' : 'none',
    marginBottom: '4px',
  }

  const contactStyle = {
    fontSize: `${selectedSize || 11}pt`,
    color: '#4a5568',
    lineHeight: '1.4',
  }

  const bodyStyle = {
    fontSize: `${selectedSize || 11}pt`,
    lineHeight: '1.6',
    color: '#1a1a1a',
    fontFamily: selectedFont,
  }

  const editableClass = 'cursor-text hover:bg-purple-50 rounded px-1 -mx-1 outline-none focus:bg-purple-50 focus:ring-1 focus:ring-purple-300'

  return (
    <div style={{ padding: '72px', fontFamily: selectedFont, fontSize: `${selectedSize || 11}pt`, lineHeight: '1.6', color: '#1a1a1a', minHeight: '1056px', boxSizing: 'border-box' }}>

      {/* Header — matches resume template style */}
      <div style={headerStyle}>
        <div
          contentEditable
          suppressContentEditableWarning
          className={editableClass}
          style={nameStyle}
          onBlur={e => update('candidateName', e.currentTarget.textContent)}
        >{clData.candidateName || 'Your Name'}</div>

        <div
          contentEditable
          suppressContentEditableWarning
          className={editableClass}
          style={contactStyle}
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
        >
          {[clData.location, clData.phone, clData.email, clData.linkedin].filter(Boolean).join(' | ') || 'City, State | Phone | Email'}
        </div>
      </div>

      {/* Date */}
      <div style={{ marginBottom: '16px', ...bodyStyle }}>
        <span
          contentEditable
          suppressContentEditableWarning
          className={editableClass}
          onBlur={e => update('date', e.currentTarget.textContent)}
        >{clData.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
      </div>

      {/* Company block */}
      <div style={{ marginBottom: '24px', ...bodyStyle }}>
        <div
          contentEditable
          suppressContentEditableWarning
          className={editableClass}
          onBlur={e => update('companyName', e.currentTarget.textContent)}
        >{clData.companyName || 'Company Name'}</div>
        <div style={{ marginTop: '4px' }}>
          <span style={{ color: '#4a5568' }}>Re: </span>
          <span
            contentEditable
            suppressContentEditableWarning
            className={editableClass}
            onBlur={e => update('jobTitle', e.currentTarget.textContent)}
          >{clData.jobTitle || 'Position Title'}</span>
        </div>
      </div>

      {/* Opening paragraph */}
      <div style={{ marginBottom: '20px', ...bodyStyle }}>
        <p
          contentEditable
          suppressContentEditableWarning
          className={editableClass}
          style={{ ...bodyStyle, display: 'block' }}
          onBlur={e => update('opening', e.currentTarget.textContent)}
        >{clData.opening || 'Opening paragraph...'}</p>
      </div>

      {/* Bullets intro */}
      <div style={{ marginBottom: '12px', ...bodyStyle }}>
        <p
          contentEditable
          suppressContentEditableWarning
          className={editableClass}
          style={{ ...bodyStyle, display: 'block' }}
          onBlur={e => update('bulletsIntro', e.currentTarget.textContent)}
        >{clData.bulletsIntro || 'Highlights of how my experience aligns with this role include:'}</p>
      </div>

      {/* Bullets */}
      <div style={{ marginBottom: '20px', paddingLeft: '8px' }}>
        {(clData.bullets || []).map((bullet, i) => (
          <div key={i} className="group/bullet flex items-start gap-2 mb-3 relative">
            <span style={{ ...bodyStyle, flexShrink: 0, marginTop: '1px' }}>•</span>
            <p
              contentEditable
              suppressContentEditableWarning
              className={`${editableClass} flex-1`}
              style={{ ...bodyStyle, display: 'block' }}
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
      <div style={{ marginBottom: '32px', ...bodyStyle }}>
        <p
          contentEditable
          suppressContentEditableWarning
          className={editableClass}
          style={{ ...bodyStyle, display: 'block' }}
          onBlur={e => update('closing', e.currentTarget.textContent)}
        >{clData.closing || 'Closing paragraph...'}</p>
      </div>

      {/* Signature */}
      <div style={bodyStyle}>
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