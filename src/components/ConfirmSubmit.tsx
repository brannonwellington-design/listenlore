"use client";

// A form submit button that asks before firing a destructive action.
export default function ConfirmSubmit({
  message,
  children,
  style,
}: {
  message: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="submit"
      style={style}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
