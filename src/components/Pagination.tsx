import { ChevronLeft, ChevronRight } from 'lucide-react';

const DS = {
  border: 'rgba(14,165,233,0.12)',
  primary: '#0ea5e9',
  text: '#dae2fd',
  muted: '#88929b',
  surface: '#0b1326',
};

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export const Pagination = ({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  // Simple range calculation for page numbers
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '16px 20px',
      borderTop: `1px solid ${DS.border}`,
      background: 'rgba(0,0,0,0.1)'
    }}>
      <div style={{ color: DS.muted, fontSize: '0.75rem', fontWeight: 600 }}>
        Showing <span style={{ color: DS.text }}>{start}</span> to <span style={{ color: DS.text }}>{end}</span> of <span style={{ color: DS.text }}>{totalItems}</span> entries
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{
            background: DS.surface,
            border: `1px solid ${DS.border}`,
            borderRadius: '8px',
            padding: '6px',
            color: currentPage === 1 ? DS.muted : DS.text,
            cursor: currentPage === 1 ? 'default' : 'pointer',
            opacity: currentPage === 1 ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s'
          }}
        >
          <ChevronLeft size={16} />
        </button>
        
        {getPageNumbers().map((p, i) => (
          p === '...' ? (
            <span key={`ellipsis-${i}`} style={{ color: DS.muted, padding: '0 4px' }}>...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              style={{
                background: currentPage === p ? DS.primary : DS.surface,
                border: currentPage === p ? 'none' : `1px solid ${DS.border}`,
                borderRadius: '8px',
                minWidth: '32px',
                height: '32px',
                padding: '0 8px',
                color: currentPage === p ? '#fff' : DS.text,
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: currentPage === p ? `0 4px 12px ${DS.primary}44` : 'none'
              }}
            >
              {p}
            </button>
          )
        ))}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{
            background: DS.surface,
            border: `1px solid ${DS.border}`,
            borderRadius: '8px',
            padding: '6px',
            color: currentPage === totalPages ? DS.muted : DS.text,
            cursor: currentPage === totalPages ? 'default' : 'pointer',
            opacity: currentPage === totalPages ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s'
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
