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
    command: 'Arial, Helvetica, sans-serif',
    prestige: 'Garamond, "Times New Roman", serif',
    signature: 'Georgia, "Times New Roman", serif',
  }

  // Use user-selected font if provided, otherwise use template default
  const ff = font || templateFonts[template] || 'Calibri, Arial, sans-serif'

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
      paddingBottom: '3px',
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
        name: { ...defaults.name, fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', fontSize: '22pt' },
        contact: { ...defaults.contact, textAlign: 'left' },
        headerArea: { ...defaults.headerArea, borderBottom: '3px solid #111', padding: '0 0 4px 0', marginBottom: '4px' },
        sectionHeader: {
          ...defaults.sectionHeader,
          fontWeight: '800',
          letterSpacing: '2px',
          borderBottom: '1.5px solid #111',
          marginTop: '14px',
          marginBottom: '4px',
        },
        jobTitle: { ...defaults.jobTitle, fontWeight: '800' },
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
        name: { ...defaults.name, fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '0' },
        headerArea: { background: 'transparent', borderBottom: `3px double ${accent}`, paddingBottom: '10px', marginBottom: '10px' },
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
        page: { ...defaults.page },
        name: { ...defaults.name, fontWeight: '400', letterSpacing: '4px', textTransform: 'uppercase' },
        contact: { ...defaults.contact, letterSpacing: '0.5px' },
        sectionHeader: {
          ...defaults.sectionHeader,
          fontStyle: 'italic',
          fontWeight: '400',
          color: accent,
          letterSpacing: '1px',
          textTransform: 'none',
          borderBottom: `1px solid ${accent}`,
        },
        jobTitle: { ...defaults.jobTitle, fontWeight: '700' },
        company: { ...defaults.company, fontStyle: 'italic', color: '#666' },
        date: { ...defaults.date },
        bullet: { ...defaults.bullet, color: accent },
        body: { ...defaults.body },
      }

    default:
      return defaults
  }
}