export default function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'} w-full max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
