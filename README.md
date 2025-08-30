# 🚀 SchemaForgeAI

**An AI-Powered Database Schema Designer & Migration Tool**

SchemaForgeAI is a modern, intelligent database schema design tool that combines the power of artificial intelligence with intuitive visual design. Create, modify, and deploy database schemas across multiple database providers with ease.

![SchemaForgeAI Main Interface](appimages/main.png)

## ✨ Features

### 🤖 AI-Powered Schema Generation
- Generate complete database schemas from natural language descriptions
- AI assistant helps refine and optimize your database design
- Intelligent relationship detection and foreign key mapping
- Smart field type suggestions and validation

### 🎨 Visual Schema Designer
- Drag-and-drop table designer
- Real-time relationship visualization
- Interactive diagram workspace with zoom and pan
- Automatic layout optimization

### 🗄️ Multi-Database Support
- **PostgreSQL** - Full support with advanced features
- **MySQL** - Complete compatibility including PlanetScale
- **SQLite** - Perfect for development and testing
- **Supabase** - Seamless integration with real-time features

### 🔄 Advanced Migration System
- Generate migration scripts automatically
- Preview changes before deployment
- Rollback capabilities
- Migration history tracking

### 🔗 Database Connectivity
- Test connections before deployment
- Support for connection strings and individual parameters
- SSL/TLS support for secure connections
- Connection pooling and timeout management

![Database Connection](appimages/db_connect.png)

### 🧠 AI Integration
- OpenRouter API support (GPT-4, Claude, Llama, etc.)
- Local AI model support via LM Studio
- Context-aware schema suggestions
- Natural language to SQL conversion

![AI Assistant](appimages/ai_connect.png)

## 🛠️ Installation

### Prerequisites
- Node.js 18.0 or higher
- npm or yarn package manager
- A supported database (PostgreSQL, MySQL, or SQLite)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/ClaudiuJitea/SchemaForgeAI.git
   cd SchemaForgeAI
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### Database Setup

SchemaForgeAI supports multiple database providers. Configure your database connection through the UI:

1. **PostgreSQL Example:**
   ```
   Connection String: postgresql://username:password@host:5432/database
   ```

2. **MySQL Example:**
   ```
   Host: localhost
   Port: 3306
   Username: root
   Password: your_password
   Database: your_database
   ```

3. **SQLite Example:**
   ```
   Database Path: ./database.sqlite
   ```

### AI Configuration

To enable AI features, configure one of the following:

#### Option 1: OpenRouter (Recommended)
1. Get an API key from [OpenRouter](https://openrouter.ai)
2. Go to Settings → AI Configuration
3. Select "OpenRouter" as provider
4. Enter your API key and choose a model (e.g., `openai/gpt-4-turbo`)

#### Option 2: Local AI (LM Studio)
1. Install and run [LM Studio](https://lmstudio.ai)
2. Load a compatible model
3. Start the local server
4. Configure the endpoint (usually `http://localhost:1234`)

## 🎯 Usage

### Creating Your First Schema

1. **Start with AI Generation**
   - Open the AI Assistant
   - Describe your database needs: "Create a blog system with users, posts, and comments"
   - Review and refine the generated schema

2. **Manual Design**
   - Click "Add Table" to create tables manually
   - Define fields, types, and constraints
   - The system automatically detects relationships

3. **Import Existing Schema**
   - Connect to your existing database
   - Import current schema structure
   - Modify and extend as needed

### Deploying Your Schema

1. **Test Connection**
   - Verify database connectivity
   - Check credentials and permissions

2. **Generate Migration**
   - Review the SQL that will be executed
   - Preview changes and potential impacts

3. **Deploy**
   - Execute the migration
   - Monitor deployment progress
   - Verify successful deployment

## 🏗️ Architecture

### Tech Stack
- **Frontend:** Next.js 14, React 18, TypeScript
- **Styling:** Tailwind CSS, Lucide Icons
- **Database Drivers:** pg, mysql2, better-sqlite3
- **AI Integration:** OpenRouter API, LM Studio
- **Internationalization:** next-intl

### Key Components
- **DiagramService:** Manages schema visualization and relationships
- **DatabaseService:** Handles multi-provider database connections
- **AIService:** Powers intelligent schema generation
- **MigrationService:** Manages schema deployments and rollbacks

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Add tests for new features
- Update documentation as needed
- Ensure accessibility compliance

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔮 Roadmap

### v2.0 (Upcoming)
- [ ] Real-time collaboration features
- [ ] Advanced indexing and performance optimization
- [ ] GraphQL schema generation
- [ ] Cloud deployment integration
- [ ] Advanced data visualization

### v2.1 (Future)
- [ ] Mobile responsive design
- [ ] Team workspace management
- [ ] Advanced AI model fine-tuning
- [ ] Custom plugin system

## 🆘 Support

- **Documentation:** [Wiki](https://github.com/ClaudiuJitea/SchemaForgeAI/wiki)
- **Issues:** [GitHub Issues](https://github.com/ClaudiuJitea/SchemaForgeAI/issues)
- **Discussions:** [GitHub Discussions](https://github.com/ClaudiuJitea/SchemaForgeAI/discussions)

## 🙏 Acknowledgments

- Thanks to the open-source community for the amazing tools and libraries
- Special thanks to all contributors and beta testers
- Inspired by modern database design tools and AI capabilities

---

**Made with ❤️ by the SchemaForgeAI Team**

⭐ If you find this project helpful, please give it a star on GitHub!