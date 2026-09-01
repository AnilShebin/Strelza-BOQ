import React from 'react';
import { Icon } from './Icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Variant style for button appearance. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'toolbar' | 'sidebar';
  /** SVG icon name from registry. */
  icon?: string;
  /** Dimension size in pixels. */
  iconSize?: number;
  /** Active toggled state. */
  active?: boolean;
  /** Notification count badge content. */
  badge?: string;
  children?: React.ReactNode;
}

/**
 * Standard Reusable UI Button.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  icon,
  iconSize = 18,
  active = false,
  badge,
  children,
  className = '',
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-accent-blue text-white hover:bg-accent-blue-hover font-semibold px-4 py-2 rounded-lg transition-all duration-200 shadow-sm flex items-center justify-center gap-2 border border-transparent';
      case 'secondary':
        return 'bg-white border border-border-color text-text-primary hover:bg-bg-app px-3.5 py-1.5 rounded-lg transition-all duration-200 shadow-sm flex items-center justify-center gap-2 font-medium';
      case 'outline':
        return 'bg-transparent border border-border-color text-text-secondary hover:bg-bg-app px-3 py-1.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium';
      case 'ghost':
        return 'bg-transparent text-text-secondary hover:bg-bg-app hover:text-text-primary p-2 rounded-lg transition-all duration-200 flex items-center justify-center';
      case 'toolbar':
        return `flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all duration-150 text-sm font-medium border border-transparent ${
          active
            ? 'bg-accent-blue-light text-accent-blue border-blue-200'
            : 'text-text-secondary hover:bg-bg-app hover:text-text-primary'
        }`;
      case 'sidebar':
        return `flex flex-col items-center justify-center gap-1.5 w-full aspect-square text-xs font-semibold rounded-xl transition-all duration-200 border-2 border-transparent ${
          active
            ? 'bg-accent-blue-light text-accent-blue border-accent-blue-light'
            : 'text-text-muted hover:bg-bg-app hover:text-text-secondary'
        }`;
      default:
        return '';
    }
  };

  return (
    <button
      className={`${getVariantStyles()} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {badge && (
        <span className="bg-accent-blue-light text-accent-blue text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 uppercase tracking-wide border border-blue-200">
          {badge}
        </span>
      )}
    </button>
  );
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'yellow' | 'grey';
}

/**
 * Standard Status Badge indicator.
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'blue',
}) => {
  const getStyles = () => {
    switch (variant) {
      case 'blue':
        return 'bg-accent-blue-light text-accent-blue border border-accent-blue-border';
      case 'yellow':
        return 'bg-brand-tropical/10 text-brand-tropical border border-brand-tropical/20';
      case 'grey':
        return 'bg-muted text-text-secondary border border-border-color';
      default:
        return '';
    }
  };

  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${getStyles()}`}>
      {children}
    </span>
  );
};
