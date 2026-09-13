// public/js/nav.js
// Dibuja la barra de navegación superior en cualquier página que lo incluya.
// Para agregar/quitar un módulo del menú, solo se edita este arreglo — no hay que tocar cada HTML.

const MODULOS_NAV = [
    { id: 'ventas',      label: 'Ventas',      href: 'ventas.html',      disponible: true  },
    { id: 'productos',   label: 'Productos',   href: 'productos.html',  disponible: true  },
    { id: 'categorias',  label: 'Categorías',  href: 'categorias.html', disponible: true  },
    { id: 'clientes',    label: 'Clientes',    href: 'clientes.html',    disponible: true  },
    { id: 'inventario',  label: 'Inventario',  href: '#',               disponible: false },
    { id: 'pedidos',     label: 'Pedidos',     href: '#',               disponible: false },
    { id: 'gastos',      label: 'Gastos',      href: '#',               disponible: false },
    { id: 'caja',        label: 'Caja',        href: '#',               disponible: false },
];

function dibujarNav() {
    const contenedor = document.getElementById('app-nav');
    if (!contenedor) return;

    const paginaActual = document.body.dataset.pagina || '';

    const tabsHtml = MODULOS_NAV.map(modulo => {
        const clases = ['tab'];
        if (modulo.id === paginaActual) clases.push('activa');
        if (modulo.destacada) clases.push('destacada');
        if (!modulo.disponible) clases.push('deshabilitada');

        const titulo = modulo.disponible ? '' : 'title="Próximamente"';
        return `<a href="${modulo.disponible ? modulo.href : '#'}" class="${clases.join(' ')}" ${titulo}>${modulo.label}</a>`;
    }).join('');

    contenedor.innerHTML = `
        <nav class="app-nav">
            <span class="marca">POSLite</span>
            <div class="tabs">${tabsHtml}</div>
        </nav>
    `;
}

dibujarNav();
