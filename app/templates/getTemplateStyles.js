// getTemplateStyles.js
// Returns style objects for each template, applied inline in ResumeContent
// Free: crisp, sharp | Pro: command, prestige, signature

export function getTemplateStyles(template, accentColor = '#5b4fcf', fontSize = 11, font = null) {
  const base = fontSize
  const accent = accentColor

  // Template default fonts — overridden by user font selection if provided
  const templateFonts = {
    crisp: 'Cambria, "Times New Roman", serif',
    sharp: 'Calibri, Arial, sans-serif',
    current: 'Calibri, Arial, sans-serif',
    command: 'Arial, Helvetica, sans-serif',
    prestige: 'Garamond, "Times New Roman", serif',
    signature: 'Garamond, "Times New Roman", serif',
    vibe: 'Georgia, "Times New Roman", serif',
    edge: 'Arial, Helvetica, sans-serif',
  }

  // Use user-selected font if provided, otherwise use template default
 const ff = font || templateFonts[template] || 'Calibri, Arial, sans-serif'
  const sharpWeight = (template === 'sharp' && ff.includes('Arial')) ? '600' : '800'

  const defaults = {
    page: {
      fontFamily: ff,
      fontSize: `${base}pt`,
      lineHeight: '1.15',
      color: '#1a1a1a',
      background: '#fff',
    },
    name: {
      fontFamily: ff,
      fontSize: '20pt',
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: '0px',       // No gap between name and contact
      letterSpacing: '0',
      textTransform: 'none',
      color: '#1a1a1a',
      fontStyle: 'normal',
      lineHeight: '1.15',
    },
    headerArea: {
      background: 'transparent',
      padding: '0',
      marginBottom: '8px',
    },
    contact: {
      fontFamily: ff,
      textAlign: 'center',
      color: '#444',
      fontSize: `${base}pt`,
      marginBottom: '0px',       // No extra gap after contact
      lineHeight: '1.15',
    },
    sectionHeader: {
      fontFamily: ff,
      fontSize: '14pt',
      fontWeight: '700',
      letterSpacing: '0',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      borderBottom: '1px solid #d1d5db',
      paddingTop: '0px',
      paddingBottom: '3px',
      paddingLeft: '0px',
      paddingRight: '0px',
      marginBottom: '8px',
      marginTop: '14px',
      fontStyle: 'normal',
      lineHeight: '1.15',
    },
    jobTitle: {
      fontFamily: ff,
      fontWeight: '700',
      color: '#1a1a1a',
      fontStyle: 'normal',
      fontSize: `${base}pt`,
    },
    company: {
      fontFamily: ff,
      color: '#555',
      fontStyle: 'normal',
      fontSize: `${base}pt`,
    },
    date: {
      fontFamily: ff,
      color: '#666',
      fontSize: `${base}pt`,
    },
    bullet: {
      fontFamily: ff,
      color: '#1a1a1a',
      fontSize: `${base}pt`,
    },
    body: {
      fontFamily: ff,
      color: '#333',
      fontSize: `${base}pt`,
    },
  }

  switch (template) {

    case 'crisp':
      return {
        ...defaults,
        page: { ...defaults.page },
        name: { ...defaults.name, letterSpacing: '2px', textTransform: 'uppercase' },
        contact: { ...defaults.contact },
        sectionHeader: {
          ...defaults.sectionHeader,
          fontSize: '13pt',
          letterSpacing: '0.5px',
          borderBottom: '1.5px solid #1a1a1a',
          marginTop: '10px',
          marginBottom: '2px',
        },
        jobTitle: { ...defaults.jobTitle },
        company: { ...defaults.company, fontStyle: 'italic' },
        date: { ...defaults.date },
        bullet: { ...defaults.bullet },
        body: { ...defaults.body },
      }

    case 'sharp':
      return {
        ...defaults,
        page: { ...defaults.page },
        name: { ...defaults.name, fontWeight: sharpWeight, letterSpacing: '0.5px', textAlign: 'left', fontSize: '22pt', borderBottom: '3px solid #111', padding: '0 0 4px 0', marginBottom: '4px' },
        contact: { ...defaults.contact, textAlign: 'left' },
        headerArea: { ...defaults.headerArea },
        sectionHeader: {
          ...defaults.sectionHeader,
          fontWeight: sharpWeight,
          letterSpacing: '2px',
          borderBottom: '1.5px solid #111',
          marginTop: '14px',
          marginBottom: '4px',
        },
        jobTitle: { ...defaults.jobTitle, fontWeight: sharpWeight },
        company: { ...defaults.company },
        date: { ...defaults.date },
        bullet: { ...defaults.bullet },
        body: { ...defaults.body },
      }

    case 'command':
      return {
        ...defaults,
        page: { ...defaults.page },
        headerArea: {
          background: accent,
          padding: '18px 24px 14px',
          marginBottom: '12px',
          marginLeft: '-24px',
          marginRight: '-24px',
          marginTop: '-0',
        },
        name: { ...defaults.name, color: '#ffffff', fontWeight: '700', letterSpacing: '1px' },
        contact: { ...defaults.contact, color: 'rgba(255,255,255,0.88)' },
        sectionHeader: {
          ...defaults.sectionHeader,
          color: accent,
          borderBottom: `2px solid ${accent}`,
          fontWeight: '700',
          letterSpacing: '1px',
        },
        jobTitle: { ...defaults.jobTitle },
        company: { ...defaults.company },
        date: { ...defaults.date },
        bullet: { ...defaults.bullet },
        body: { ...defaults.body },
      }

    case 'prestige':
      return {
        ...defaults,
        page: { ...defaults.page },
        name: { ...defaults.name, fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '4px' },
        headerArea: { background: 'transparent', padding: '0', marginBottom: '0' },
        professionalTitle: { fontFamily: ff, fontStyle: 'italic', fontWeight: '700', color: accent, fontSize: `${base}pt`, letterSpacing: '1px', textAlign: 'center', marginBottom: '6px', lineHeight: '1.15' },
        contactBand: { background: accent + '18', borderTop: `2px solid ${accent}`, borderBottom: `1px solid ${accent}33`, padding: '5px 8px', marginBottom: '12px' },
        contact: { ...defaults.contact, color: '#555' },
        sectionHeader: {
          ...defaults.sectionHeader,
          letterSpacing: '1.5px',
          borderBottom: 'none',
          borderLeft: `3px solid ${accent}`,
          paddingLeft: '8px',
        },
        jobTitle: { ...defaults.jobTitle },
        company: { ...defaults.company, fontStyle: 'italic', color: '#666' },
        date: { ...defaults.date },
        bullet: { ...defaults.bullet },
        body: { ...defaults.body },
      }

    case 'signature':
      return {
        ...defaults,
        page: { ...defaults.page, lineHeight: '1.3' },
        name: { ...defaults.name, fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', textAlign: 'center', fontSize: '24pt' },
        contact: { ...defaults.contact, textAlign: 'center', letterSpacing: '0.3px' },
        professionalTitle: { fontFamily: ff, fontSize: `${base}pt`, color: accent, letterSpacing: '1px', textAlign: 'center', marginBottom: '8px', lineHeight: '1.2' },
        contactBand: {},
        headerArea: { ...defaults.headerArea, textAlign: 'center', borderBottom: '1px solid #ccc', padding: '0 0 10px 0', marginBottom: '4px' },
        sectionHeader: {
          ...defaults.sectionHeader,
          fontWeight: '700',
          color: '#1a1a1a',
          letterSpacing: '2px',
          textAlign: 'center',
          background: accent + '22',
          paddingTop: '3px',
          paddingBottom: '3px',
          paddingLeft: '6px',
          paddingRight: '6px',
          borderBottom: 'none',
          fontStyle: 'normal',
          textTransform: 'uppercase',
        },
        jobTitle: { ...defaults.jobTitle, fontWeight: '700' },
        company: { ...defaults.company, color: '#555' },
        date: { ...defaults.date },
        bullet: { ...defaults.bullet },
        body: { ...defaults.body, lineHeight: '1.3' },
      }

    case 'current':
      return {
        ...defaults,
        name: { ...defaults.name, letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center' },
        contact: { ...defaults.contact, textAlign: 'center' },
        professionalTitle: { fontFamily: ff, fontSize: `${base}pt`, textAlign: 'center', color: '#555', letterSpacing: '1px', marginBottom: '6px', lineHeight: '1.15' },
        contactBand: {},
        sectionHeader: { ...defaults.sectionHeader, textAlign: 'center', borderBottom: '1px solid #ccc', borderTop: '1px solid #ccc', borderLeft: 'none', borderRight: 'none', paddingTop: '2px', paddingBottom: '2px', paddingLeft: '0px', paddingRight: '0px', letterSpacing: '2px' },
        jobTitle: { ...defaults.jobTitle },
        company: { ...defaults.company },
      }

    case 'vibe':
      return {
        ...defaults,
        name: { ...defaults.name, fontSize: '20pt', fontWeight: '700', textAlign: 'left', letterSpacing: '1px', textTransform: 'uppercase' },
        contact: { ...defaults.contact, textAlign: 'left' },
        professionalTitle: { fontFamily: ff, fontSize: `${base}pt`, textAlign: 'left', color: '#555', letterSpacing: '0.5px', marginBottom: '6px', lineHeight: '1.15' },
        contactBand: {},
        sectionHeader: { ...defaults.sectionHeader, borderBottom: 'none', borderTop: `1px solid ${accent}`, borderLeft: 'none', borderRight: 'none', paddingTop: '2px', paddingBottom: '2px', paddingLeft: '0px', paddingRight: '0px', letterSpacing: '2px', color: '#1a1a1a', background: accent + '18' },
        jobTitle: { ...defaults.jobTitle },
        company: { ...defaults.company },
      }

    case 'edge':
      return {
        ...defaults,
        name: { ...defaults.name, fontSize: '22pt', fontWeight: '700', textAlign: 'center', letterSpacing: '1px', textTransform: 'uppercase' },
        contact: { ...defaults.contact, textAlign: 'center' },
        professionalTitle: { fontFamily: ff, fontSize: `${base + 1}pt`, fontWeight: '700', textAlign: 'center', color: '#1a1a1a', letterSpacing: '1px', marginBottom: '6px', lineHeight: '1.15', textTransform: 'uppercase' },
        contactBand: {},
        sectionHeader: { ...defaults.sectionHeader, background: accent + '33', borderBottom: 'none', borderLeft: 'none', borderRight: 'none', paddingTop: '3px', paddingBottom: '3px', paddingLeft: '8px', paddingRight: '8px', letterSpacing: '2px', color: '#1a1a1a', fontStyle: 'italic' },
        jobTitle: { ...defaults.jobTitle },
        company: { ...defaults.company },
      }

    default:
      return defaults
  }
}