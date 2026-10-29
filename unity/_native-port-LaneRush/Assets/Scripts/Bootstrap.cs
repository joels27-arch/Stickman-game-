// Lane Rush starts itself: press Play in any scene (even an empty one) and the game builds
// its world, camera and UI in code. No scene setup needed.
using UnityEngine;

namespace LaneRush
{
    public static class Bootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Start()
        {
            if (Object.FindFirstObjectByType<Game>() != null) return;
            var go = new GameObject("Lane Rush");
            go.AddComponent<Game>();
        }
    }
}
