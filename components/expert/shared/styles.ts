/**
 * Expert 컴포넌트 공통 스타일
 * Phase 22: 컴포넌트 공통화
 */

/**
 * 비활성화 상태 스타일
 */
export function getDisabledClasses(disabled?: boolean): string {
  if (!disabled) return '';
  return 'opacity-50 cursor-not-allowed pointer-events-none';
}

/**
 * 버튼 기본 스타일
 */
export function getButtonClasses(options: {
  disabled?: boolean;
  selected?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
} = {}): string {
  const { disabled = false, selected = false, variant = 'primary', size = 'md' } = options;

  const baseClasses = 'rounded-lg transition-all duration-200 font-medium';

  // 크기
  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }[size];

  // 변형
  const variantClasses = {
    primary: selected
      ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-md'
      : 'bg-white border-2 border-orange-200 text-orange-600 hover:bg-orange-50',
    secondary: selected
      ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-md'
      : 'bg-white border-2 border-purple-200 text-purple-600 hover:bg-purple-50',
    danger: selected
      ? 'bg-red-500 text-white hover:bg-red-600 shadow-md'
      : 'bg-white border-2 border-red-200 text-red-600 hover:bg-red-50',
  }[variant];

  // 비활성화
  const disabledClasses = getDisabledClasses(disabled);

  return `${baseClasses} ${sizeClasses} ${variantClasses} ${disabledClasses}`;
}

/**
 * Input 필드 스타일
 */
export function getInputClasses(options: {
  disabled?: boolean;
  error?: boolean;
  focused?: boolean;
} = {}): string {
  const { disabled = false, error = false, focused = false } = options;

  const baseClasses = 'px-4 py-2 rounded-lg border-2 transition-all duration-200';

  const borderColor = error ? 'border-red-300' : focused ? 'border-orange-400' : 'border-gray-200';

  const bgColor = disabled ? 'bg-gray-100' : 'bg-white';

  const disabledClasses = getDisabledClasses(disabled);

  return `${baseClasses} ${borderColor} ${bgColor} ${disabledClasses}`;
}

/**
 * 섹션 컨테이너 스타일
 */
export function getSectionClasses(options: {
  highlighted?: boolean;
  compact?: boolean;
} = {}): string {
  const { highlighted = false, compact = false } = options;

  const baseClasses = 'rounded-xl transition-all duration-200';

  const paddingClasses = compact ? 'p-4' : 'p-6';

  const bgClasses = highlighted
    ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200'
    : 'bg-white border border-gray-200';

  return `${baseClasses} ${paddingClasses} ${bgClasses}`;
}

/**
 * 로딩 인디케이터 스타일
 */
export function getLoadingClasses(): string {
  return 'inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin';
}

/**
 * 유틸리티: 조건부 클래스 결합
 */
export function classNames(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
