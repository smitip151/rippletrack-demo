import { describe, it, expect } from 'vitest';
import { dispatchEvent } from '../src/analytics/eventTracker';
import * as fs from 'fs';
import * as path from 'path';
describe('Analytics Pipeline & Contract Integrity', () => {
    it('should successfully format and dispatch the user payload without crashing', () => {
        const mockPath = path.join(__dirname, 'mocks', 'userFixture.json');
        const userMock = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
        expect(() => dispatchEvent('USER_LOGIN', userMock)).not.toThrow();
        expect(dispatchEvent('USER_LOGIN', userMock).username).toBe('tifosi_dev');
    });
    it('should validate the mock fixture against the schema constraints', () => {
        const mockPath = path.join(__dirname, 'mocks', 'userFixture.json');
        const userMock = JSON.parse(fs.readFileSync(mockPath, 'utf-8'));
        expect('id' in userMock && 'username' in userMock).toBe(true);
    });
});