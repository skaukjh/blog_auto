/**
 * Expert 컴포넌트 공통 타입
 * Phase 22: 컴포넌트 공통화
 */

/**
 * 모든 Expert UI 컴포넌트의 기본 Props
 */
export interface BaseExpertComponentProps {
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 클래스명 커스터마이징 */
  className?: string;
}

/**
 * 선택 가능한 컴포넌트 Props
 */
export interface SelectableComponentProps extends BaseExpertComponentProps {
  /** 선택된 값 */
  value?: string | string[];
  /** 선택 이벤트 핸들러 */
  onChange?: (value: string | string[]) => void;
  /** 다중 선택 여부 */
  multiple?: boolean;
}

/**
 * 버튼 컴포넌트 Props
 */
export interface ButtonComponentProps extends BaseExpertComponentProps {
  /** 클릭 이벤트 핸들러 */
  onClick?: () => void | Promise<void>;
  /** 버튼 텍스트 */
  label?: string;
  /** 버튼 타입 */
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * 폼 필드 Props
 */
export interface FormFieldProps extends BaseExpertComponentProps {
  /** 필드 레이블 */
  label?: string;
  /** 필드명 */
  name?: string;
  /** 필드값 */
  value?: any;
  /** 필드 타입 */
  type?: 'text' | 'number' | 'select' | 'textarea' | 'checkbox';
  /** 필드 변경 핸들러 */
  onChange?: (value: any) => void;
  /** 에러 메시지 */
  error?: string;
  /** 도움말 텍스트 */
  helperText?: string;
}
