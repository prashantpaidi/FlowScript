// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { findLabelForInput } from './dom';

describe('findLabelForInput', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('should find label via aria-label', () => {
        document.body.innerHTML = '<input id="test" aria-label="Username">';
        const el = document.getElementById('test') as HTMLElement;
        expect(findLabelForInput(el)).toBe('Username');
    });

    it('should find label via placeholder', () => {
        document.body.innerHTML = '<input id="test" placeholder="Enter name">';
        const el = document.getElementById('test') as HTMLElement;
        expect(findLabelForInput(el)).toBe('Enter name');
    });

    it('should find label via title', () => {
        document.body.innerHTML = '<input id="test" title="Some Hint">';
        const el = document.getElementById('test') as HTMLElement;
        expect(findLabelForInput(el)).toBe('Some Hint');
    });

    it('should find label via aria-labelledby', () => {
        document.body.innerHTML = `
            <div id="l1">First Name</div>
            <input id="test" aria-labelledby="l1">
        `;
        const el = document.getElementById('test') as HTMLElement;
        expect(findLabelForInput(el)).toBe('First Name');
    });

    it('should find label via explicit for attribute', () => {
        document.body.innerHTML = `
            <label for="test">Email Address</label>
            <input id="test">
        `;
        const el = document.getElementById('test') as HTMLElement;
        expect(findLabelForInput(el)).toBe('Email Address');
    });

    it('should find implicit label', () => {
        document.body.innerHTML = `
            <label>
                Password
                <input id="test">
            </label>
        `;
        const el = document.getElementById('test') as HTMLElement;
        // JSDOM textContent will include whitespace/newlines
        expect(findLabelForInput(el)).toContain('Password');
    });

    it('should find label via "The Climb" (parent sibling)', () => {
        document.body.innerHTML = `
            <div class="form-row">
                <div class="label">Phone Number</div>
                <div class="input-wrapper">
                    <input id="test">
                </div>
            </div>
        `;
        const el = document.getElementById('test') as HTMLElement;
        expect(findLabelForInput(el)).toBe('Phone Number');
    });

    it('should find label via "The Climb" (element sibling)', () => {
        document.body.innerHTML = `
            <span>Birth Date</span>
            <input id="test">
        `;
        const el = document.getElementById('test') as HTMLElement;
        expect(findLabelForInput(el)).toBe('Birth Date');
    });

    it('should pierce Shadow DOM during "The Climb"', () => {
        // Create container in light DOM
        document.body.innerHTML = `
            <div id="outer-label">External Label</div>
            <div id="host"></div>
        `;
        
        const host = document.getElementById('host')!;
        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <div class="inner-wrapper">
                <input id="test">
            </div>
        `;
        
        const el = shadow.getElementById('test') as HTMLElement;
        
        // When climbing from input:
        // 1. input (depth 0) - no prev sibling
        // 2. inner-wrapper (depth 1) - no prev sibling
        // 3. host (depth 2) - prev sibling is outer-label
        expect(findLabelForInput(el)).toBe('External Label');
    });
});
