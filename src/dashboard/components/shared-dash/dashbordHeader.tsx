import GSSLogo from "C:/GSS_IOT/GSS-IOT-Frontend-eunho-ui/GSS-IOT-Frontend-eunho-ui/src/assets/GSS_Logo.png"

const WhiteHeader = () => {
  return (
    <header className="w-[102%] bg-[#F9FAFB] py-1 border-b border-gray-300 shadow-sm flex justify-between items-center px-6">
      <h1 className="text-gray-800 font-bold text-2xl text-center flex-1">
        비계전도 감시 시스템
      </h1>
      <img
        src={GSSLogo}
        alt="GSS Logo"
        className="w-16 h-auto object-contain scale-[2.5] mr-4"
      />
    </header>
  )
}

export default WhiteHeader
