// public/js/nav.js
// Dibuja la barra de navegación superior en cualquier página que lo incluya.
// Para agregar/quitar un módulo del menú, solo se edita este arreglo — no hay que tocar cada HTML.

const MODULOS_NAV = [
    { id: 'ventas',      label: 'Ventas',      href: 'ventas.html',      disponible: true  },
    { id: 'productos',   label: 'Productos',   href: 'productos.html',  disponible: true  },
    { id: 'categorias',  label: 'Categorías',  href: 'categorias.html', disponible: true  },
    { id: 'clientes',    label: 'Clientes',    href: 'clientes.html',    disponible: true  },
    { id: 'inventario',  label: 'Inventario',  href: 'inventario.html',  disponible: true  },
    { id: 'pedidos',     label: 'Pedidos',     href: '#',               disponible: false },
    { id: 'gastos',      label: 'Gastos',      href: 'gastos.html',      disponible: true  },
    { id: 'caja',        label: 'Caja',        href: 'caja.html',        disponible: true  },
    { id: 'usuarios',    label: 'Usuarios',    href: 'usuarios.html',    disponible: true  },
];

function dibujarNav(usuario) {
    const contenedor = document.getElementById('app-nav');
    if (!contenedor) return;

    const paginaActual = document.body.dataset.pagina || '';

    const tabsHtml = MODULOS_NAV.filter(modulo => modulo.id !== 'usuarios' || usuario?.rol === 'administrador').map(modulo => {
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
            <button class="btn btn-sm btn-outline-light ms-auto" id="btn-cerrar-sesion" type="button">Salir</button>
        </nav>
    `;

    document.getElementById('btn-cerrar-sesion').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    });
}

async function comprobarSesion() {
    if (document.body.dataset.pagina === 'login') return;
    const respuesta = await fetch('/api/auth/me');
    if (!respuesta.ok) {
        window.location.href = '/login.html';
        return;
    }
    const datos = await respuesta.json();
    dibujarNav(datos.usuario);
}

comprobarSesion();
