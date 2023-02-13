describe('disposable tests', () => {
    test('merge two arrays to hashmap', () => {
        const keys = ['key-1', 'key-2', 'key-3'];
        const vals = [10, 20, 30];
        const mapped: Record<string, number> = {};
        keys.forEach((key, i) => (mapped[key] = vals[i]));
        console.log(mapped);
    });
});
