let cors = require("cors");
let express = require("express");
let mysql = require("serverless-mysql");

const app = express();
const porta = 3000;

app.use(cors());
app.use(express.json());

let bd = mysql({
    config: {
        host: '127.0.0.1',
        database: 'iftm_filmes',
        user: 'root',
        password: ''
    }
})

app.get('/filmes/:pagina', async (req, res) => {
    let pagina = parseInt(req.params.pagina);
    let limite = 10;
    let offset = (pagina - 1) * limite;

    let filmes = await bd.query(`SELECT * FROM filmes LIMIT ?, ?`, [offset, limite]);

    res.json(filmes);

    await bd.end();
});

app.get('/filme/:id', async(req, res) => {
    let id = req.params.id;
    let filme = await bd.query(`SELECT * FROM filmes WHERE id = ?`, [id]);
    
    if (filme.length === 0) {
        res.status(404).json({ mensagem: "Filme não encontrado! :(" });
        return;
    }
    res.json(filme);

    await bd.end();
});

app.get('/filmes/busca/:palavra', async (req, res) => {
    try {
        let palavra = req.params.palavra;
        let filmes = await bd.query(`
            SELECT 
                f.*,
                g.nome as genero,
                GROUP_CONCAT(DISTINCT a.nome) as atores
            FROM filmes f
            LEFT JOIN filmes_generos fg ON f.id = fg.filme_id
            LEFT JOIN generos g ON fg.genero_id = g.id
            LEFT JOIN atores_filmes af ON f.id = af.filme_id
            LEFT JOIN atores a ON af.ator_id = a.id
            WHERE 
                f.titulo LIKE CONCAT('%', ?, '%')
            GROUP BY f.id
            ORDER BY f.nota DESC`, 
            [palavra]
        );

        if (filmes.length === 0) {
            res.status(404).json({ mensagem: "Nenhum filme encontrado" });
            return;
        }

        res.json(filmes);
    } catch (erro) {
        res.status(500).json({ erro: "Erro na busca de filmes" });
    } finally {
        await bd.end();
    }
});

app.get('/generos/:genero', async (req, res) => {
    let genero = req.params.genero;
    let filmes = await bd.query(`
        SELECT 
            f.id,
            f.titulo,
            f.ano,
            f.sinopse
        FROM filmes f
        INNER JOIN filmes_generos fg ON f.id = fg.filme_id
        INNER JOIN generos g ON fg.genero_id = g.id
        WHERE g.titulo = ?
        ORDER BY f.ano DESC`, [genero]);

    res.json(filmes);
    
    await bd.end();
});

app.get('/ator/:id', async (req, res) => {
    let id = req.params.id;
    let ator = await bd.query(`SELECT * FROM atores WHERE id = ?`, [id]);

    res.json(ator);

    await bd.end();
})

app.get('/atores/busca/:palavra', async (req, res) => {
    let palavra = req.params.palavra;
    let atores = await bd.query (`
        SELECT 
          a.nome AS ator,
          GROUP_CONCAT(f.titulo SEPARATOR ', ') AS filmes
        FROM 
          atores AS a
        INNER JOIN 
          atores_filmes AS af ON a.id = af.ator_id
        INNER JOIN 
          filmes AS f ON af.filme_id = f.id
        WHERE 
          a.nome LIKE CONCAT('%', ?, '%') OR 
          f.titulo LIKE CONCAT('%', ?, '%')
        GROUP BY 
          a.id;`)
  
      res.json(results);

      await bd.end(); 
});

app.listen(porta, () => {
    console.log(`Servidor rodando em http://127.0.0.1:${porta}`);
});
