#if NETFRAMEWORK
namespace System.Runtime.CompilerServices
{
    // C# records / init setters need this marker on .NET Framework.
    internal static class IsExternalInit { }
}
#endif
