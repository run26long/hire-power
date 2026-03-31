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
  const rawFont = selectedFont || 'Lato'
  const font = rawFont === 'Source Serif 4' ? '"Source Serif 4"' : rawFont
  const contactLine = [clData.location, clData.phone, clData.email, clData.linkedin].filter(Boolean).join(' | ')
  const bulletsIntro = clData.bulletsIntro || 'Highlights of how my experience aligns with this role include:'

  const editableClass = 'cursor-text hover:bg-purple-50 rounded px-1 -mx-1 outline-none focus:bg-purple-50 focus:ring-1 focus:ring-purple-300'

  const body = {
    fontFamily: font,
    fontSize: `${base}pt`,
    lineHeight: '1.2',
    color: '#1a1a1a',
  }

  const pagePadding = (selectedTemplate === 'sharp' || selectedTemplate === 'vibe') ? '48px' : '57px'

  const contactEditProps = {
    contentEditable: true,
    suppressContentEditableWarning: true,
    className: editableClass,
    onBlur: e => {
      const parts = e.currentTarget.textContent.split('|').map(p => p.trim())
      onUpdate({
        ...clData,
        location: parts[0] || clData.location,
        phone: parts[1] || clData.phone,
        email: parts[2] || clData.email,
        linkedin: parts[3] || clData.linkedin,
      })
    }
  }

  const renderHeader = () => {
    switch (selectedTemplate?.toLowerCase()) {

      case 'vibe':
        return (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
              <div style={{ flex: 1 }}>
                <div contentEditable suppressContentEditableWarning className={editableClass}
                  style={{ fontFamily: font, fontSize: '24pt', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#1a1a1a', lineHeight: '1.1', display: 'block', marginBottom: '6px' }}
                  onBlur={e => update('candidateName', e.currentTarget.textContent)}
                >{clData.candidateName || 'Your Name'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {[clData.email, clData.phone && clData.location ? `${clData.phone} | ${clData.location}` : (clData.phone || clData.location), clData.linkedin].filter(Boolean).map((line, i) => (
                  <div key={i} style={{ fontFamily: font, fontSize: `${base}pt`, color: '#555', lineHeight: '1.4' }}>{line}</div>
                ))}
              </div>
            </div>
            <hr style={{ border: 'none', borderBottom: '1px solid #aaaaaa', margin: '2px 0 20px 0' }} />
          </>
        )

      case 'sharp':
        return (
          <>
            <div contentEditable suppressContentEditableWarning className={editableClass}
              style={{ fontFamily: font, fontSize: '22pt', fontWeight: '700', letterSpacing: '0.5px', color: '#111', lineHeight: '1.2', display: 'block', marginBottom: '4px' }}
              onBlur={e => update('candidateName', e.currentTarget.textContent)}
            >{clData.candidateName || 'Your Name'}</div>
            <div style={{ borderBottom: '1.5px solid #111', marginBottom: '8px' }} />
            <div {...contactEditProps}
              style={{ fontFamily: font, fontSize: `${base}pt`, color: '#444', lineHeight: '1.3', display: 'block', marginBottom: '20px' }}
            >{contactLine || 'City, State | Phone | Email'}</div>
          </>
        )

      case 'crisp':
        return (
          <>
            <div contentEditable suppressContentEditableWarning className={editableClass}
              style={{ fontFamily: font, fontSize: '20pt', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: '#1a1a1a', textAlign: 'center', marginBottom: '0px', lineHeight: '1.3', display: 'block' }}
              onBlur={e => update('candidateName', e.currentTarget.textContent)}
            >{clData.candidateName || 'Your Name'}</div>
            <div {...contactEditProps}
              style={{ fontFamily: font, fontSize: `${base}pt`, color: '#444', textAlign: 'center', lineHeight: '1.3', marginBottom: '8px', display: 'block' }}
            >{contactLine || 'City, State | Phone | Email'}</div>
          </>
        )

      case 'command':
        return (
          <div style={{ background: '#5b4fcf', paddingTop: '18px', paddingBottom: '14px', paddingLeft: '57px', paddingRight: '57px', marginLeft: '-57px', marginRight: '-57px', marginTop: '-57px', marginBottom: '20px' }}>
            <div contentEditable suppressContentEditableWarning className={editableClass}
              style={{ fontFamily: font, fontSize: `${base + 9}pt`, fontWeight: '700', letterSpacing: '1px', color: '#fff', textAlign: 'center', lineHeight: '1.1', display: 'block', marginBottom: '4px' }}
              onBlur={e => update('candidateName', e.currentTarget.textContent)}
            >{clData.candidateName || 'Your Name'}</div>
            <div {...contactEditProps}
              style={{ fontFamily: font, fontSize: `${base}pt`, color: 'rgba(255,255,255,0.88)', textAlign: 'center', lineHeight: '1.3', display: 'block' }}
            >{contactLine || 'City, State | Phone | Email'}</div>
          </div>
        )

      case 'prestige':
        return (
          <>
            <div contentEditable suppressContentEditableWarning className={editableClass}
              style={{ fontFamily: font, fontSize: '22pt', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: '#1a1a1a', lineHeight: '1.1', marginBottom: '4px', display: 'block' }}
              onBlur={e => update('candidateName', e.currentTarget.textContent)}
            >{clData.candidateName || 'Your Name'}</div>
            <div style={{ background: 'rgba(91,79,207,0.094)', borderTop: '2px solid #5b4fcf', borderBottom: '1px solid rgba(91,79,207,0.2)', paddingTop: '6px', paddingBottom: '6px', paddingLeft: pagePadding, paddingRight: pagePadding, marginLeft: `-${pagePadding}`, marginRight: `-${pagePadding}`, marginBottom: '8px' }}>
              <div {...contactEditProps}
                style={{ fontFamily: font, fontSize: `${base}pt`, color: '#444', lineHeight: '1.1', display: 'block' }}
              >{contactLine || 'City, State | Phone | Email'}</div>
            </div>
          </>
        )

      case 'signature':
        return (
          <>
            <div contentEditable suppressContentEditableWarning className={editableClass}
              style={{ fontFamily: font, fontSize: '24pt', fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', color: '#1a1a1a', lineHeight: '1.1', display: 'block', marginBottom: '8px', textAlign: 'center' }}
              onBlur={e => update('candidateName', e.currentTarget.textContent)}
            >{clData.candidateName || 'Your Name'}</div>
            <div style={{ background: 'rgba(91,79,207,0.133)', padding: '3px 6px', marginBottom: '16px', textAlign: 'center' }}>
              <div {...contactEditProps}
                style={{ fontFamily: font, fontSize: `${base - 1}pt`, color: '#555', textAlign: 'center', letterSpacing: '0.3px', lineHeight: '1.4', display: 'block' }}
              >{contactLine || 'City, State | Phone | Email'}</div>
            </div>
          </>
        )

      case 'edge':
        return (
          <>
            <div contentEditable suppressContentEditableWarning className={editableClass}
              style={{ fontFamily: font, fontSize: '22pt', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', color: '#1a1a1a', lineHeight: '1.1', display: 'block', marginBottom: '4px', textAlign: 'center' }}
              onBlur={e => update('candidateName', e.currentTarget.textContent)}
            >{clData.candidateName || 'Your Name'}</div>
            <div style={{ background: 'rgba(91,79,207,0.2)', borderRadius: '20px', padding: '3px 10px', marginBottom: '14px', textAlign: 'center' }}>
              <div {...contactEditProps}
                style={{ fontFamily: font, fontSize: `${base - 0.5}pt`, color: '#555', textAlign: 'center', lineHeight: '1.3', display: 'block' }}
              >{contactLine || 'City, State | Phone | Email'}</div>
            </div>
          </>
        )

      default: // current
        return (
          <>
            <div style={{ textAlign: 'center', marginBottom: 0 }}>
              <div contentEditable suppressContentEditableWarning className={editableClass}
                style={{ fontFamily: font, fontSize: '22pt', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '4px', lineHeight: '1.1', display: 'block' }}
                onBlur={e => update('candidateName', e.currentTarget.textContent)}
              >{clData.candidateName || 'Your Name'}</div>
            </div>
            <hr style={{ border: 'none', borderBottom: '1px solid #bbb', margin: '0' }} />
            <div {...contactEditProps}
              style={{ fontFamily: font, fontSize: `${base}pt`, color: '#555', textAlign: 'center', lineHeight: '1.3', letterSpacing: '0.2px', padding: '6px 0', display: 'block' }}
            >{contactLine || 'City, State | Phone | Email'}</div>
            <hr style={{ border: 'none', borderBottom: '1px solid #bbb', margin: '0 0 20px 0' }} />
          </>
        )
    }
  }

  return (
    <div style={{
      padding: pagePadding,
      fontFamily: font,
      fontSize: `${base}pt`,
      lineHeight: '1.3',
      color: '#1a1a1a',
      minHeight: '1056px',
      boxSizing: 'border-box',
      backgroundColor: '#fff',
    }}>

      {renderHeader()}

      {/* Date */}
      <div style={{ ...body, marginBottom: '48px', marginTop: '48px' }}>
        <span contentEditable suppressContentEditableWarning className={editableClass}
          onBlur={e => update('date', e.currentTarget.textContent)}
        >{clData.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
      </div>

      {/* Memo block — To / Re */}
      <div style={{ ...body, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '16px' }}>
          <span style={{ color: '#555', flexShrink: 0 }}>To:</span>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span contentEditable suppressContentEditableWarning className={editableClass}
              onBlur={e => update('recipientName', e.currentTarget.textContent)}
            >{clData.recipientName || 'Hiring Manager'}</span>
            <span
              title="💡 Replace with the hiring manager's name if you have it. Check the job posting or LinkedIn."
              style={{ cursor: 'help', background: '#ede9fe', color: '#7c3aed', fontSize: '10px', fontWeight: '600', padding: '1px 6px', borderRadius: '999px', flexShrink: 0, letterSpacing: '0.2px' }}
            >edit</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ color: '#555', flexShrink: 0 }}>Re:</span>
          <span contentEditable suppressContentEditableWarning className={editableClass}
            onBlur={e => update('jobTitle', e.currentTarget.textContent)}
          >{clData.jobTitle || 'Position Title'}</span>
          <span style={{ color: '#555' }}>position at</span>
          <span contentEditable suppressContentEditableWarning className={editableClass}
            onBlur={e => update('companyName', e.currentTarget.textContent)}
          >{clData.companyName || 'Company Name'}</span>
        </div>
      </div>

      {/* Opening paragraph */}
      <p contentEditable suppressContentEditableWarning className={editableClass}
        style={{ ...body, display: 'block', marginBottom: '16px' }}
        onBlur={e => update('opening', e.currentTarget.textContent)}
      >{clData.opening || 'Opening paragraph...'}</p>

      {/* Bullets intro */}
      <p contentEditable suppressContentEditableWarning className={editableClass}
        style={{ ...body, display: 'block', marginBottom: '10px' }}
        onBlur={e => update('bulletsIntro', e.currentTarget.textContent)}
      >{bulletsIntro}</p>

      {/* Bullets */}
      <div style={{ marginBottom: '20px', paddingLeft: '8px' }}>
        {(clData.bullets || []).map((bullet, i) => (
          <div key={i} className="group/bullet flex items-start gap-2 mb-3 relative">
            <span style={{ ...body, flexShrink: 0, marginTop: '1px' }}>•</span>
            <p contentEditable suppressContentEditableWarning className={`${editableClass} flex-1`}
              style={{ ...body, display: 'block' }}
              onBlur={e => updateBullet(i, e.currentTarget.textContent)}
            >{bullet}</p>
            <button onClick={() => removeBullet(i)}
              className="opacity-0 group-hover/bullet:opacity-100 text-red-400 hover:text-red-600 text-xs px-1 flex-shrink-0 transition-opacity"
              title="Remove bullet"
            >🗑️</button>
          </div>
        ))}
        <button onClick={addBullet}
          className="text-purple-600 text-xs hover:text-purple-700 mt-1 opacity-50 hover:opacity-100"
        >+ Add bullet</button>
      </div>

      {/* Closing */}
      <p contentEditable suppressContentEditableWarning className={editableClass}
        style={{ ...body, display: 'block', marginBottom: '20px' }}
        onBlur={e => update('closing', e.currentTarget.textContent)}
      >{clData.closing || 'Closing paragraph...'}</p>

      {/* Signature */}
      <div style={body}>
        <div style={{ marginBottom: '4px' }}>Sincerely,</div>
        <div style={{ marginTop: '36px' }}>
          <span contentEditable suppressContentEditableWarning className={editableClass}
            style={{ fontWeight: '400' }}
            onBlur={e => update('candidateName', e.currentTarget.textContent)}
          >{clData.candidateName || 'Your Name'}</span>
        </div>
      </div>

    </div>
  )
}