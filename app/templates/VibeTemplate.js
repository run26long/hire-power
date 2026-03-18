// VibeTemplate.js — Flanked section headers, two-column header | Pro tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function VibeTemplate({ resumeData, font, fontSize, spacing = 1, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const sp = spacing || 1;
  const color = accentColor || '#5b4fcf';
  const fontFamily = font || 'Georgia, "Times New Roman", serif';
  const px = (n) => `${Math.round(n * sp)}px`;
  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || '';

  const s = {
    page: {
      fontFamily,
      fontSize: `${base}pt`,
      lineHeight: '1.2',
      color: '#1a1a1a',
      padding: `${px(36)} ${px(52)}`,
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    hdr: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: px(10),
      paddingBottom: px(8),
    },
    hdrLeft: {
      flex: 1,
    },
    hdrRight: {
      textAlign: 'right',
      fontSize: `${base}pt`,
      color: '#555',
      lineHeight: '1.4',
    },
    name: {
      fontFamily,
      fontSize: '24pt',
      fontWeight: '700',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: px(3),
      lineHeight: '1.1',
    },
    title: {
      fontFamily,
      fontSize: `${base}pt`,
      fontWeight: '400',
      color: '#555',
      letterSpacing: '0.5px',
      lineHeight: '1.2',
    },
    shWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: px(8),
      marginBottom: px(8),
      marginTop: px(18),
    },
    shLine: {
      flex: 1,
      height: '1px',
      background: '#aaa',
      alignSelf: 'center',
    },
    shText: {
      fontFamily,
      fontSize: `${base}pt`,
      fontWeight: '700',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      whiteSpace: 'nowrap',
      lineHeight: '1.2',
    },
    section: { marginTop: px(4) },
    entry: { marginBottom: px(8) },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
    jt: { fontFamily, fontWeight: '700', fontSize: `${base}pt`, lineHeight: '1.2', color: '#1a1a1a' },
    jobMeta: { fontFamily, fontSize: `${base}pt`, color: '#555', marginBottom: px(2), lineHeight: '1.2' },
    sm: { fontFamily, fontSize: `${base}pt`, color: '#333', margin: `${px(2)} 0 ${px(3)}`, lineHeight: '1.2' },
    li: { fontFamily, margin: `${px(1)} 0`, fontSize: `${base}pt`, display: 'flex', alignItems: 'flex-start', gap: '4px', lineHeight: '1.2' },
    body: { fontFamily, fontSize: `${base}pt`, color: '#333', margin: `0 0 ${px(3)}`, lineHeight: '1.2' },
  };

  const contactParts = [
    resumeData.email,
    resumeData.phone,
    resumeData.location,
    resumeData.linkedin,
    resumeData.portfolio,
  ].filter(Boolean);

  const SH = ({ title }) => (
    <div style={s.shWrap}>
      <div style={s.shLine} />
      <div style={s.shText}>{title}</div>
      <div style={s.shLine} />
    </div>
  );

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.hdr}>
        <div style={s.hdrLeft}>
          <div style={s.name}>{resumeData.fullName}</div>
          {professionalTitle && <div style={s.title}>{professionalTitle}</div>}
        </div>
        <div style={s.hdrRight}>
          {resumeData.email && resumeData.phone && resumeData.location
            ? <>
                {resumeData.email && <div>{resumeData.email}</div>}
                {resumeData.phone && resumeData.location
                  ? <div>{resumeData.phone} | {resumeData.location}</div>
                  : <>
                      {resumeData.phone && <div>{resumeData.phone}</div>}
                      {resumeData.location && <div>{resumeData.location}</div>}
                    </>
                }
                {resumeData.linkedin && <div>{resumeData.linkedin}</div>}
                {resumeData.portfolio && <div>{resumeData.portfolio}</div>}
              </>
            : contactParts.map((p, i) => <div key={i}>{p}</div>)
          }
        </div>
      </div>

      {/* Summary */}
      {resumeData.summary && !resumeData.hideSummary && (
        <div style={{ ...s.section, marginTop: '0' }}>
          <SH title={resumeData.sectionTitles?.summary || 'Professional Summary'} />
          <p style={s.body}>{resumeData.summary}</p>
        </div>
      )}

      {/* Experience */}
      {resumeData.experience?.length > 0 && (
        <div style={s.section}>
          <SH title="Work Experience" />
          {resumeData.experience.map((job, i) => (
            <div key={i} style={i < resumeData.experience.length - 1 ? s.entry : {}}>
              <div style={s.jt}>{job.title}</div>
              <div style={s.jobMeta}>
                {[job.company, job.location, formatDateRange(job.startDate, job.endDate, job.current, dateFormat)]
                  .filter(Boolean).join(' | ')}
              </div>
              {job.summary && !job.summaryDismissed && <p style={s.sm}>{job.summary}</p>}
              {job.bullets?.length > 0 && (
                <div style={{ marginTop: px(2) }}>
                  {job.bullets.map((b, k) => (
                    <div key={k} style={s.li}>
                      <span style={{ flexShrink: 0 }}>•</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {resumeData.education?.length > 0 && (
        <div style={s.section}>
          <SH title="Education" />
          {resumeData.education.map((ed, i) => (
            <div key={i} style={i < resumeData.education.length - 1 ? s.entry : {}}>
              <div style={s.row}>
                <span style={s.jt}>{ed.school}</span>
                <span style={{ fontFamily, fontSize: `${base}pt`, color: '#555' }}>{formatDate(ed.graduationDate, dateFormat)}</span>
              </div>
              <div style={s.jobMeta}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</div>
              {ed.lines?.map((l, k) => <div key={k} style={{ fontFamily, fontSize: `${base}pt`, color: '#333', lineHeight: '1.2' }}>{l}</div>)}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {Object.keys(skills).length > 0 && (
        <div style={s.section}>
          <SH title="Skills" />
          {Object.entries(skills).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: px(3) }}>
              {Object.keys(skills).length > 1
                ? <><span style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{cat}: </span>
                    <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span></>
                : <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span>
              }
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {resumeData.certifications?.length > 0 && (
        <div style={s.section}>
          <SH title="Certifications" />
          {resumeData.certifications.map((c, i) => (
            <div key={i} style={i < resumeData.certifications.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontSize: `${base}pt` }}>
                <strong>{c.name}</strong>{c.details ? ` | ${c.details}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Volunteer */}
      {resumeData.volunteer?.length > 0 && (
        <div style={s.section}>
          <SH title="Volunteer Experience" />
          {resumeData.volunteer.map((v, i) => (
            <div key={i} style={i < resumeData.volunteer.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{v.organization}</div>
              <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{v.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {resumeData.projects?.length > 0 && (
        <div style={s.section}>
          <SH title="Projects" />
          {resumeData.projects.map((p, i) => (
            <div key={i} style={i < resumeData.projects.length - 1 ? s.entry : {}}>
              <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{p.name}{p.link ? ` | ${p.link}` : ''}</div>
              <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{p.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Additional Information */}
      {resumeData.additionalInfo?.length > 0 && (
        <div style={s.section}>
          <SH title="Additional Information" />
          {resumeData.additionalInfo.map((item, i) => (
            <div key={i} style={i < resumeData.additionalInfo.length - 1 ? { marginBottom: px(3) } : {}}>
              <div style={{ fontFamily, fontSize: `${base}pt`, lineHeight: '1.2', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                <strong>{item.label}</strong>
                {item.detail && <span style={{ color: '#555' }}>| {item.detail}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Languages */}
      {resumeData.languages?.length > 0 && (
        <div style={s.section}>
          <SH title="Languages" />
          <div style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>
            {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
          </div>
        </div>
      )}
    </div>
  );
}