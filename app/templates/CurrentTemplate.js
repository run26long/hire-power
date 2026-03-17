// CurrentTemplate.js — Centered editorial | Free tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function CurrentTemplate({ resumeData, font, fontSize, spacing = 1, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const sp = spacing || 1;
  const fontFamily = font || 'Calibri, Arial, sans-serif';
  const px = (n) => `${Math.round(n * sp)}px`;
  const professionalTitle = resumeData.professionalTitle || resumeData.experience?.[0]?.title || '';

  // TODO: build styles and JSX
  return <div style={{ fontFamily, fontSize: `${base}pt`, padding: px(36) }}>Current template coming soon</div>;
}