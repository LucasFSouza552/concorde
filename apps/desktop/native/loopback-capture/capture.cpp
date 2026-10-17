// Concorde native process-loopback capture.
//
// Captura SOMENTE o audio das sessoes pertencentes a uma arvore de processos
// (WASAPI Process Loopback) e escreve PCM cru no stdout.
//
// Uso:  concorde-loopback-capture.exe --pid <PID>
//
// stdout: primeira linha = header JSON (rate/channels/bits/encoding),
//         seguida de PCM cru no formato indicado (little-endian, intercalado).
// stderr: diagnostico (nao corrompe o PCM).
//
// Restricao de projeto: NUNCA captura audio global do sistema. Se a ativacao
// falhar, o processo apenas encerra — quem chamou decide o fallback (video sem
// audio + aviso).

#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef _WIN32_WINNT
#define _WIN32_WINNT 0x0A00
#endif
#ifndef WINVER
#define WINVER 0x0A00
#endif
#ifndef NTDDI_VERSION
#define NTDDI_VERSION 0x0A00000C
#endif

#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <wrl.h>
#include <wrl/implements.h>
#include <fcntl.h>
#include <io.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

using namespace Microsoft::WRL;

class ActivationHandler
    : public RuntimeClass<RuntimeClassFlags<ClassicCom>, FtmBase,
                          IActivateAudioInterfaceCompletionHandler> {
public:
    explicit ActivationHandler(HANDLE ev) : m_ev(ev) {}

    STDMETHOD(ActivateCompleted)
    (IActivateAudioInterfaceAsyncOperation* operation) override {
        ComPtr<IUnknown> punk;
        HRESULT activateHr = E_UNEXPECTED;
        HRESULT hr = operation->GetActivateResult(&activateHr, &punk);
        if (SUCCEEDED(hr) && SUCCEEDED(activateHr) && punk) {
            punk.As(&m_client);
        }
        m_hr = activateHr;
        SetEvent(m_ev);
        return S_OK;
    }

    HRESULT hr() const { return m_hr; }
    ComPtr<IAudioClient> client() const { return m_client; }

private:
    HANDLE m_ev;
    HRESULT m_hr = E_UNEXPECTED;
    ComPtr<IAudioClient> m_client;
};

static int WriteAll(const void* data, size_t bytes) {
    const char* p = (const char*)data;
    while (bytes > 0) {
        size_t n = fwrite(p, 1, bytes, stdout);
        if (n == 0) return 0; 
        p += n;
        bytes -= n;
    }
    return 1;
}

int main(int argc, char** argv) {
    DWORD pid = 0;
    int seconds = 0; 
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--pid") == 0 && i + 1 < argc) {
            pid = (DWORD)strtoul(argv[++i], nullptr, 10);
        } else if (strcmp(argv[i], "--seconds") == 0 && i + 1 < argc) {
            seconds = atoi(argv[++i]);
        }
    }
    if (pid == 0) {
        fprintf(stderr, "uso: concorde-loopback-capture --pid <PID>\n");
        return 2;
    }

    _setmode(_fileno(stdout), _O_BINARY);
    setvbuf(stderr, nullptr, _IONBF, 0);

    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (hr != S_OK && hr != S_FALSE && hr != RPC_E_CHANGED_MODE) {
        fprintf(stderr, "CoInitializeEx hr=0x%08lX\n", (unsigned long)hr);
        return 3;
    }

    HANDLE ev = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    if (!ev) {
        fprintf(stderr, "CreateEvent falhou\n");
        return 3;
    }
    ComPtr<ActivationHandler> handler = Make<ActivationHandler>(ev);
    if (!handler) {
        fprintf(stderr, "handler alloc falhou\n");
        return 3;
    }

    AUDIOCLIENT_ACTIVATION_PARAMS params = {};
    params.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
    params.ProcessLoopbackParams.TargetProcessId = pid;
    params.ProcessLoopbackParams.ProcessLoopbackMode =
        PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;

    PROPVARIANT pv = {};
    pv.vt = VT_BLOB;
    pv.blob.cbSize = sizeof(params);
    pv.blob.pBlobData = (BYTE*)&params;

    ComPtr<IActivateAudioInterfaceAsyncOperation> asyncOp;
    hr = ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
                                     __uuidof(IAudioClient), &pv, handler.Get(),
                                     &asyncOp);
    if (FAILED(hr)) {
        fprintf(stderr, "ActivateAudioInterfaceAsync hr=0x%08lX\n", (unsigned long)hr);
        return 3;
    }
    DWORD wait = WaitForSingleObject(ev, 5000);
    if (wait != WAIT_OBJECT_0 || FAILED(handler->hr()) || !handler->client()) {
        fprintf(stderr, "ativacao falhou hr=0x%08lX wait=%lu\n",
                (unsigned long)handler->hr(), (unsigned long)wait);
        return 3;
    }
    ComPtr<IAudioClient> client = handler->client();

    WAVEFORMATEX fmt = {};
    fmt.wFormatTag = WAVE_FORMAT_PCM;
    fmt.nChannels = 2;
    fmt.nSamplesPerSec = 48000;
    fmt.wBitsPerSample = 16;
    fmt.nBlockAlign = (WORD)(fmt.nChannels * fmt.wBitsPerSample / 8);
    fmt.nAvgBytesPerSec = fmt.nSamplesPerSec * fmt.nBlockAlign;
    fmt.cbSize = 0;

    hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED,
                            AUDCLNT_STREAMFLAGS_LOOPBACK |
                                AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                            200000, 0, &fmt, nullptr);
    if (FAILED(hr)) {
        fprintf(stderr, "Initialize hr=0x%08lX\n", (unsigned long)hr);
        return 3;
    }

    hr = client->SetEventHandle(ev);
    if (FAILED(hr)) {
        fprintf(stderr, "SetEventHandle hr=0x%08lX\n", (unsigned long)hr);
        return 3;
    }

    ComPtr<IAudioCaptureClient> capture;
    hr = client->GetService(__uuidof(IAudioCaptureClient), &capture);
    if (FAILED(hr) || !capture) {
        fprintf(stderr, "GetService hr=0x%08lX\n", (unsigned long)hr);
        return 3;
    }

    fflush(stdout);
    printf("{\"rate\":%lu,\"channels\":%u,\"bits\":%u,\"encoding\":\"s16le\"}\n",
           (unsigned long)fmt.nSamplesPerSec, (unsigned)fmt.nChannels,
           (unsigned)fmt.wBitsPerSample);
    fflush(stdout);
    fprintf(stderr, "capture pid=%lu rate=%lu ch=%u bits=%u enc=s16le\n",
            (unsigned long)pid, (unsigned long)fmt.nSamplesPerSec,
            (unsigned)fmt.nChannels, (unsigned)fmt.wBitsPerSample);

    hr = client->Start();
    if (FAILED(hr)) {
        fprintf(stderr, "Start hr=0x%08lX\n", (unsigned long)hr);
        return 3;
    }

    const UINT32 blockAlign = fmt.nBlockAlign;
    char zeros[8192];
    memset(zeros, 0, sizeof(zeros));

    ULONGLONG start = GetTickCount64();
    for (;;) {
        if (seconds > 0 && GetTickCount64() - start >= (ULONGLONG)seconds * 1000) break;
        DWORD w = WaitForSingleObject(ev, 200);
        (void)w;
        UINT32 packet = 0;
        int readSomething = 0;
        while (SUCCEEDED(capture->GetNextPacketSize(&packet)) && packet > 0) {
            BYTE* data = nullptr;
            UINT32 frames = 0;
            DWORD flags = 0;
            hr = capture->GetBuffer(&data, &frames, &flags, nullptr, nullptr);
            if (FAILED(hr)) break;

            UINT32 bytes = frames * blockAlign;
            if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
                UINT32 remaining = bytes;
                while (remaining > 0) {
                    UINT32 chunk = remaining > sizeof(zeros) ? (UINT32)sizeof(zeros) : remaining;
                    if (!WriteAll(zeros, chunk)) { exit(0); }
                    remaining -= chunk;
                }
            } else if (data && bytes > 0) {
                if (!WriteAll(data, bytes)) { exit(0); }
            }
            capture->ReleaseBuffer(frames);
            readSomething = 1;
        }
        fflush(stdout);
        if (!readSomething) Sleep(1);
    }

    // inalcancavel (encerrado pelo processo pai)
}
