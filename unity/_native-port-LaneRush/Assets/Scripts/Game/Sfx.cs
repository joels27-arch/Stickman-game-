// Little game sounds made in code (no audio files yet): short blips, whooshes and chimes.
using System.Collections.Generic;
using UnityEngine;

namespace LaneRush
{
    public sealed class Sfx : MonoBehaviour
    {
        const int Rate = 44100;
        readonly Dictionary<string, AudioClip> clips = new Dictionary<string, AudioClip>();
        AudioSource src;

        void Awake()
        {
            src = gameObject.AddComponent<AudioSource>();
            src.playOnAwake = false;
            Make("coin", 0.09f, t => Tone(t, t < 0.04f ? 1320 : 1760) * Env(t, 0.09f) * 0.35f);
            Make("jump", 0.14f, t => Tone(t, 420 + t * 2600) * Env(t, 0.14f) * 0.3f);
            Make("whoosh", 0.12f, t => Noise() * Env(t, 0.12f) * 0.18f);
            Make("bonk", 0.2f, t => Tone(t, 160 - t * 300) * Env(t, 0.2f) * 0.6f);
            Make("boost", 0.3f, t => Tone(t, 500 + t * 1800) * Env(t, 0.3f) * 0.3f);
            Make("slow", 0.25f, t => Tone(t, 400 - t * 900) * Env(t, 0.25f) * 0.3f);
            Make("box", 0.25f, t => (Tone(t, 880) + Tone(t, 1320)) * Env(t, 0.25f) * 0.2f);
            Make("shield", 0.35f, t => Tone(t, 660 + Mathf.Sin(t * 60) * 80) * Env(t, 0.35f) * 0.3f);
            Make("rocket", 0.6f, t => (Noise() * 0.6f + Tone(t, 90)) * Env(t, 0.6f) * 0.35f);
            Make("go", 0.4f, t => Tone(t, t < 0.2f ? 660 : 990) * Env(t, 0.4f) * 0.35f);
            Make("over", 0.7f, t => Tone(t, 440 - t * 300) * Env(t, 0.7f) * 0.35f);
        }

        static float Tone(float t, float hz) => Mathf.Sin(2 * Mathf.PI * hz * t);
        static float Noise() => Random.value * 2 - 1;
        static float Env(float t, float len) => Mathf.Clamp01(t / 0.01f) * Mathf.Clamp01(1 - t / len);

        void Make(string name, float len, System.Func<float, float> f)
        {
            int n = Mathf.CeilToInt(len * Rate);
            var data = new float[n];
            for (int i = 0; i < n; i++) data[i] = f(i / (float)Rate);
            var clip = AudioClip.Create(name, n, 1, Rate, false);
            clip.SetData(data, 0);
            clips[name] = clip;
        }

        public void Play(string name)
        {
            if (clips.TryGetValue(name, out var c)) src.PlayOneShot(c);
        }
    }
}
