'use client';

import { useRouter } from 'next/navigation';

export default function Breadcrumb({ items }) {
  const router = useRouter();

  return (
    <div className="bg-gray-50 border-b border-gray-200 sticky top-[57px] z-40">
      <div className="px-6 py-1.5 flex items-center text-xs">
        {items.map((item, index) => (
          <span key={index} className="flex items-center">
            {index > 0 && <span className="mx-2 text-gray-400">|</span>}
            {item.path ? (
              <button
                onClick={() => router.push(item.path)}
                className="text-gray-600 hover:text-purple-600"
              >
                {item.label}
              </button>
            ) : (
              <span
                className="text-purple-700 font-semibold rounded-md px-3 py-1"
                style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)' }}
              >
                {item.label}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}