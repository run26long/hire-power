// getTemplateStyles.js
// Returns style objects for each template, applied inline in ResumeContent
// Free: crisp, sharp | Pro: command, prestige, signature

export function getTemplateStyles(template, accentColor = '#5b4fcf', fontSize = 11) {
  const base = fontSize
  const accent = accentColor

  const defaults = {
    page: {
      fontFamily: 'Calibri, Arial, sans-serif',
      fontSize: `${base}pt`,
      lineHeight: '1.45',
      color: '#1a1a1a',
      background: '#fff',
    },
    name: {
      fontSize: `${base + 13}pt`,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: '4px',
      letterSpacing: '0',
      textTransform: 'none',
      color: '#1a1a1a',
      fontStyle: 'normal',
    },
    headerArea: {
      background: 'transparent',
      padding: '0',
      marginBottom: '8px',
    },
    contact: {
      textAlign: 'center',
      color: '#444',
      fontSize: `${base - 1}pt`,
    },
    sectionHeader: {
      fontSize: '1.125rem',
      fontWeight: '700',
      letterSpacing: '0',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      borderBottom: '1px solid #d1d5db',
      paddingBottom: '3px',
      marginBottom: '8px',
      marginTop: '14px',
      fontStyle: 'normal',
    },
    jobTitle: {
      fontWeight: '700',
      color: '#1a1a1a',
      fontStyle: 'normal',
    },
    company: {
      color: '#555',
      fontStyle: 'normal',
    },
    date: {
      color: '#666',
      fontSize: `${base - 1}pt`,
    },
    bullet: {
      color: '#1a1a1a',
    },
    body: {
      color: '#333',
    },
  }

  switch (template) {

    case 'crisp':
      return {
        ...defaults,
        page: { ...defaults.page, fontFamily: 'Georgia, "Times New Roman", serif' },
        name: { ...defaults.name, fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', fontSize: `${base + 12}pt` },
        sectionHeader: {
          ...defaults.sectionHeader,
          fontFamily: 'Georgia, serif',
          letterSpacing: '1.5px',
          borderBottom: '1.5px solid #1a1a1a',
        },
        jobTitle: { ...defaults.jobTitle, fontFamily: 'Georgia, serif' },
        company: { ...defaults.company, fontStyle: 'italic' },
      }

    case 'sharp':
      return {
        ...defaults,
        page: { ...defaults.page, fontFamily: '"Trebuchet MS", Arial, sans-serif' },
        name: { ...defaults.name, fontWeight: '800', letterSpacing: '1px', fontSize: `${base + 14}pt` },
        sectionHeader: {
          ...defaults.sectionHeader,
          fontFamily: '"Trebuchet MS", Arial, sans-serif',
          fontWeight: '800',
          letterSpacing: '2px',
          borderBottom: '2.5px solid #1a1a1a',
          fontSize: '1.125rem',
        },
        jobTitle: { ...defaults.jobTitle, fontWeight: '800' },
      }

    case 'command':
      return {
        ...defaults,
        page: { ...defaults.page, fontFamily: 'Arial, Helvetica, sans-serif' },
        headerArea: {
          background: accent,
          padding: '18px 24px 14px',
          marginBottom: '12px',
          marginLeft: '-52px',
          marginRight: '-52px',
          marginTop: '-48px',
        },
        name: {
          ...defaults.name,
          color: '#ffffff',
          fontWeight: '700',
          letterSpacing: '1px',
          fontSize: `${base + 14}pt`,
        },
        contact: { ...defaults.contact, color: 'rgba(255,255,255,0.88)', fontSize: `${base - 1}pt` },
        sectionHeader: {
          ...defaults.sectionHeader,
          color: accent,
          borderBottom: `2px solid ${accent}`,
          fontWeight: '700',
          letterSpacing: '1px',
        },
        jobTitle: { ...defaults.jobTitle, color: '#1a1a1a' },
      }

    case 'prestige':
      return {
        ...defaults,
        page: { ...defaults.page, fontFamily: '"Palatino Linotype", Palatino, Georgia, serif' },
        name: {
          ...defaults.name,
          fontWeight: '700',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          fontSize: `${base + 11}pt`,
          marginBottom: '0',
        },
        headerArea: {
          background: 'transparent',
          borderBottom: `3px double ${accent}`,
          paddingBottom: '10px',
          marginBottom: '10px',
        },
        contact: { ...defaults.contact, color: '#555', fontSize: `${base - 1}pt` },
        sectionHeader: {
          ...defaults.sectionHeader,
          fontFamily: '"Palatino Linotype", Palatino, Georgia, serif',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          borderBottom: 'none',
          borderLeft: `3px solid ${accent}`,
          paddingLeft: '8px',
          color: '#1a1a1a',
          fontSize: '1.125rem',
        },
        jobTitle: { ...defaults.jobTitle, fontFamily: '"Palatino Linotype", serif' },
        company: { ...defaults.company, fontStyle: 'italic', color: '#666' },
      }

    case 'signature':
      return {
        ...defaults,
        page: { ...defaults.page, fontFamily: '"Palatino Linotype", Palatino, Georgia, serif' },
        name: {
          ...defaults.name,
          fontWeight: '400',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          fontSize: `${base + 10}pt`,
          fontFamily: '"Palatino Linotype", serif',
        },
        contact: { ...defaults.contact, letterSpacing: '0.5px' },
        sectionHeader: {
          ...defaults.sectionHeader,
          fontStyle: 'italic',
          fontWeight: '400',
          color: accent,
          letterSpacing: '1px',
          textTransform: 'none',
          borderBottom: `1px solid ${accent}`,
          fontSize: '1.125rem',
          fontFamily: '"Palatino Linotype", serif',
        },
        jobTitle: { ...defaults.jobTitle, fontFamily: '"Palatino Linotype", serif', fontWeight: '700' },
        company: { ...defaults.company, fontStyle: 'italic', color: '#666' },
        bullet: { color: accent },
      }

    default:
      return defaults
  }
}