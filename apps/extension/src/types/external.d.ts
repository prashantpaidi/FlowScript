declare module 'prismjs';
declare module 'prismjs/components/prism-json';

declare module 'react-simple-code-editor' {
    import * as React from 'react';

    export interface EditorProps {
        value: string;
        onValueChange: (value: string) => void;
        highlight: (value: string) => string | React.ReactNode;
        padding?: number | string;
        style?: React.CSSProperties;
        onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
        onKeyUp?: React.KeyboardEventHandler<HTMLTextAreaElement>;
        onClick?: React.MouseEventHandler<HTMLTextAreaElement>;
        onFocus?: React.FocusEventHandler<HTMLTextAreaElement>;
        onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
        tabSize?: number;
        insertSpaces?: boolean;
        ignoreTabKey?: boolean;
        className?: string;
        textareaId?: string;
        textareaClassName?: string;
        preClassName?: string;
        autoFocus?: boolean;
        disabled?: boolean;
        placeholder?: string;
        required?: boolean;
        form?: string;
    }

    const Editor: React.ComponentType<EditorProps>;
    export default Editor;
}
